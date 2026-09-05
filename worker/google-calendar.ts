import {
  createGoogleCalendarDatabase,
  GOOGLE_CALENDAR_DATABASE_ID,
  GOOGLE_CALENDAR_PROPERTY_IDS,
  getValue,
} from "../app/personal-space/model.ts";
import type { Database, Item, Row } from "../app/personal-space/types.ts";
import {
  getGoogleAccessToken,
  isGoogleTasksConfigured,
  type GoogleTasksDatabase,
  type GoogleTasksEnv,
  type GoogleTasksStatement,
} from "./google-tasks.ts";
import { isWorkspaceItems, loadWorkspace, saveWorkspace } from "./workspace-store.ts";
import { createRemoteOnce, GoogleSyncSafetyError, readCreateReceipts, withGoogleSyncLock, type SyncGuard } from "./google-sync-guard.ts";

const STATE_ID = "primary";
const CALENDAR_API_URL = "https://www.googleapis.com/calendar/v3";

export type GoogleCalendarDatabase = GoogleTasksDatabase;

type GoogleCalendar = {
  id: string;
  summary?: string;
  description?: string;
  accessRole?: string;
  timeZone?: string;
  primary?: boolean;
  hidden?: boolean;
};

type GoogleCalendarEvent = {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  etag?: string;
  updated?: string;
  attendees?: Array<{ email?: string }>;
  recurrence?: string[];
  recurringEventId?: string;
  start?: { date?: string; dateTime?: string; timeZone?: string };
  end?: { date?: string; dateTime?: string; timeZone?: string };
};

type GoogleCollection<T> = { items?: T[]; nextPageToken?: string };
type StoredCalendarState = { last_sync_at: string | null; last_error: string | null };
type StoredMapping = {
  local_row_id: string;
  calendar_id: string;
  remote_event_id: string;
  remote_etag: string;
  remote_updated: string;
  local_fingerprint: string;
};

export type GoogleCalendarStatus = {
  configured: boolean;
  connected: boolean;
  needsReconnect?: boolean;
  calendars: Array<{ id: string; title: string; primary: boolean }>;
  lastSyncAt: string | null;
  error?: string;
};

export type GoogleCalendarSyncSummary = {
  imported: number;
  exported: number;
  updated: number;
  removed: number;
  conflicts: number;
  calendarCount: number;
};

class GoogleCalendarError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.name = "GoogleCalendarError";
    this.status = status;
  }
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
  },
});

const isCalendarWriter = (calendar: GoogleCalendar) => calendar.accessRole === "owner" || calendar.accessRole === "writer";

const calendarSchema = [
  `CREATE TABLE IF NOT EXISTS google_calendar_state (
    id TEXT PRIMARY KEY NOT NULL,
    last_sync_at TEXT,
    last_error TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS google_calendar_mapping (
    local_row_id TEXT PRIMARY KEY NOT NULL,
    calendar_id TEXT NOT NULL,
    remote_event_id TEXT NOT NULL,
    remote_etag TEXT NOT NULL,
    remote_updated TEXT NOT NULL,
    local_fingerprint TEXT NOT NULL,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_google_calendar_mapping_remote_event ON google_calendar_mapping (calendar_id, remote_event_id)`,
  `CREATE INDEX IF NOT EXISTS idx_google_calendar_mapping_calendar ON google_calendar_mapping (calendar_id)`,
];

const ensureCalendarSchema = async (database: GoogleCalendarDatabase) => {
  for (const statement of calendarSchema) await database.prepare(statement).run();
  await database.prepare(`INSERT OR IGNORE INTO google_calendar_state (id) VALUES (?)`).bind(STATE_ID).run();
};

const readState = (database: GoogleCalendarDatabase) => database.prepare(`SELECT last_sync_at, last_error
FROM google_calendar_state
WHERE id = ?`).bind(STATE_ID).first<StoredCalendarState>();

const updateState = (database: GoogleCalendarDatabase, lastSyncAt: string | null, lastError: string | null) => database.prepare(`UPDATE google_calendar_state
SET last_sync_at = ?, last_error = ?, updated_at = CURRENT_TIMESTAMP
WHERE id = ?`).bind(lastSyncAt, lastError?.slice(0, 500) || null, STATE_ID);

const apiJson = async <T>(url: string, accessToken: string, init: RequestInit = {}): Promise<T> => {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(url, { ...init, headers, signal: init.signal || AbortSignal.timeout(15000) });
  const body = await response.text();
  let parsed: unknown = null;
  try { parsed = body ? JSON.parse(body) : null; } catch { parsed = null; }
  if (!response.ok) {
    const message = typeof parsed === "object" && parsed && "error" in parsed
      ? String((parsed as { error?: { message?: string } }).error?.message || "Google Calendar request failed")
      : `Google Calendar request failed (${response.status})`;
    throw new GoogleCalendarError(message, response.status);
  }
  return parsed as T;
};

const listCalendars = async (token: string) => {
  const calendars: GoogleCalendar[] = [];
  let pageToken = "";
  do {
    const query = new URLSearchParams({ maxResults: "250", minAccessRole: "reader" });
    if (pageToken) query.set("pageToken", pageToken);
    const result = await apiJson<GoogleCollection<GoogleCalendar>>(`${CALENDAR_API_URL}/users/me/calendarList?${query}`, token);
    calendars.push(...(result.items || []));
    pageToken = result.nextPageToken || "";
  } while (pageToken);
  return calendars;
};

const mapConcurrent = async <T, R>(values: T[], mapper: (value: T) => Promise<R>, concurrency = 6) => {
  const results = new Array<R>(values.length);
  let nextIndex = 0;
  const worker = async () => {
    while (true) {
      const index = nextIndex++;
      if (index >= values.length) return;
      results[index] = await mapper(values[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker));
  return results;
};

const hydrateRecurringEvents = async (token: string, calendarId: string, events: GoogleCalendarEvent[]) => {
  const masterIds = [...new Set(events
    .map((event) => event.recurringEventId)
    .filter((eventId): eventId is string => Boolean(eventId)))];
  if (!masterIds.length) return events;

  const masters = await mapConcurrent(masterIds, async (eventId) => {
    try {
      return await apiJson<GoogleCalendarEvent>(
        `${CALENDAR_API_URL}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?fields=id,recurrence,attendees`,
        token,
      );
    } catch (error) {
      // A deleted series can still leave an instance in the expansion window.
      // Keep that instance usable instead of failing the complete calendar sync.
      if (error instanceof GoogleCalendarError && (error.status === 404 || error.status === 410)) return null;
      throw error;
    }
  });
  const masterById = new Map(
    masters
      .filter((master): master is GoogleCalendarEvent => Boolean(master?.id && (master.recurrence?.length || master.attendees !== undefined)))
      .map((master) => [master.id, master] as const),
  );

  return events.map((event) => {
    const master = event.recurringEventId ? masterById.get(event.recurringEventId) : undefined;
    if (!master) return event;
    return {
      ...event,
      ...(event.recurrence?.length ? {} : master.recurrence?.length ? { recurrence: master.recurrence } : {}),
      ...(event.attendees === undefined && master.attendees ? { attendees: master.attendees } : {}),
    };
  });
};

const listEvents = async (token: string, calendarId: string) => {
  const events: GoogleCalendarEvent[] = [];
  let pageToken = "";
  const now = Date.now();
  const timeMin = new Date(now - 45 * 24 * 60 * 60 * 1000).toISOString();
  const timeMax = new Date(now + 365 * 24 * 60 * 60 * 1000).toISOString();
  do {
    const query = new URLSearchParams({
      maxResults: "2500",
      orderBy: "startTime",
      showDeleted: "true",
      singleEvents: "true",
      timeMin,
      timeMax,
    });
    if (pageToken) query.set("pageToken", pageToken);
    const result = await apiJson<GoogleCollection<GoogleCalendarEvent>>(`${CALENDAR_API_URL}/calendars/${encodeURIComponent(calendarId)}/events?${query}`, token);
    events.push(...(result.items || []));
    pageToken = result.nextPageToken || "";
  } while (pageToken);
  return hydrateRecurringEvents(token, calendarId, events);
};

const textValue = (row: Row, id: string) => {
  const value = getValue(row, id);
  return Array.isArray(value) ? value.join(", ") : value === null || value === undefined ? "" : String(value);
};

const boolValue = (row: Row, id: string) => Boolean(getValue(row, id));
const remoteKey = (calendarId: string, eventId: string) => `${calendarId}\u0000${eventId}`;

const nextDay = (value: string) => {
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return "";
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
};

const dateTimeValue = (value: string) => {
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return `${value}:00Z`;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(value)) return `${value}Z`;
  return value;
};

type GoogleCalendarPayload = {
  summary: string;
  description?: string;
  location?: string;
  attendees?: Array<{ email: string }>;
  recurrence?: string[];
  start: { date: string } | { dateTime: string };
  end: { date: string } | { dateTime: string };
};

const attendeeValues = (value: string) => {
  const seen = new Set<string>();
  return value
    .split(/[,;\n]+/)
    .map((email) => email.trim())
    .filter((email) => {
      if (!email) return false;
      const normalized = email.toLowerCase();
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    })
    .map((email) => ({ email }));
};

const recurrenceValues = (value: string) => value
  .split(/\r?\n/)
  .map((entry) => entry.trim())
  .filter(Boolean);

export const googleCalendarPayload = (row: Row): GoogleCalendarPayload | null => {
  const start = textValue(row, GOOGLE_CALENDAR_PROPERTY_IDS.start).trim();
  const end = textValue(row, GOOGLE_CALENDAR_PROPERTY_IDS.end).trim();
  if (!start) return null;
  const allDay = boolValue(row, GOOGLE_CALENDAR_PROPERTY_IDS.allDay);
  const startValue = allDay ? start.slice(0, 10) : dateTimeValue(start);
  const endValue = allDay ? (end ? end.slice(0, 10) : nextDay(startValue)) : dateTimeValue(end || start);
  if (!startValue || !endValue) return null;
  const description = textValue(row, GOOGLE_CALENDAR_PROPERTY_IDS.notes).trim();
  const location = textValue(row, GOOGLE_CALENDAR_PROPERTY_IDS.location).trim();
  const attendees = attendeeValues(textValue(row, GOOGLE_CALENDAR_PROPERTY_IDS.attendees));
  const recurrence = recurrenceValues(textValue(row, GOOGLE_CALENDAR_PROPERTY_IDS.recurrence));
  return {
    summary: row.title.trim() || "Untitled event",
    ...(description ? { description } : {}),
    ...(location ? { location } : {}),
    ...(attendees.length ? { attendees } : {}),
    ...(recurrence.length ? { recurrence } : {}),
    start: allDay ? { date: startValue } : { dateTime: startValue },
    end: allDay ? { date: endValue } : { dateTime: endValue },
  };
};

const calendarRowFingerprint = (row: Row) => JSON.stringify(googleCalendarPayload(row));

export const googleCalendarToRow = (event: GoogleCalendarEvent, calendar: GoogleCalendar, existing?: Row): Row => {
  const allDay = Boolean(event.start?.date);
  return {
    id: existing?.id || `google-calendar-${calendar.id}-${event.id}`,
    title: event.summary?.trim() || "Untitled event",
    values: {
      ...(existing?.values || {}),
      [GOOGLE_CALENDAR_PROPERTY_IDS.status]: event.status === "tentative" ? "Tentative" : event.status === "cancelled" ? "Cancelled" : "Confirmed",
      [GOOGLE_CALENDAR_PROPERTY_IDS.start]: event.start?.date || event.start?.dateTime || "",
      [GOOGLE_CALENDAR_PROPERTY_IDS.end]: event.end?.date || event.end?.dateTime || "",
      [GOOGLE_CALENDAR_PROPERTY_IDS.allDay]: allDay,
      [GOOGLE_CALENDAR_PROPERTY_IDS.calendar]: calendar.summary || calendar.id,
      [GOOGLE_CALENDAR_PROPERTY_IDS.calendarId]: calendar.id,
      [GOOGLE_CALENDAR_PROPERTY_IDS.location]: event.location || "",
      [GOOGLE_CALENDAR_PROPERTY_IDS.attendees]: event.attendees?.map((attendee) => attendee.email?.trim()).filter((email): email is string => Boolean(email)).join(", ") || "",
      [GOOGLE_CALENDAR_PROPERTY_IDS.recurrence]: event.recurrence?.join("\n") || "",
      [GOOGLE_CALENDAR_PROPERTY_IDS.notes]: event.description || "",
      [GOOGLE_CALENDAR_PROPERTY_IDS.link]: event.htmlLink || "",
      [GOOGLE_CALENDAR_PROPERTY_IDS.id]: event.id,
      [GOOGLE_CALENDAR_PROPERTY_IDS.etag]: event.etag || "",
      [GOOGLE_CALENDAR_PROPERTY_IDS.updated]: event.updated || "",
    },
    blocks: existing?.blocks || [],
  };
};

const insertEvent = (token: string, calendarId: string, payload: GoogleCalendarPayload) => apiJson<GoogleCalendarEvent>(
  `${CALENDAR_API_URL}/calendars/${encodeURIComponent(calendarId)}/events?sendUpdates=all`,
  token,
  { method: "POST", body: JSON.stringify(payload) },
);

const updateEvent = (token: string, calendarId: string, eventId: string, payload: GoogleCalendarPayload) => apiJson<GoogleCalendarEvent>(
  `${CALENDAR_API_URL}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=all`,
  token,
  { method: "PUT", body: JSON.stringify(payload) },
);

const deleteEvent = async (token: string, calendarId: string, eventId: string) => {
  try {
    await apiJson<null>(`${CALENDAR_API_URL}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, token, { method: "DELETE" });
  } catch (error) {
    if (!(error instanceof GoogleCalendarError) || error.status !== 404) throw error;
  }
};

const readMappings = async (database: GoogleCalendarDatabase) => {
  const result = await database.prepare(`SELECT local_row_id, calendar_id, remote_event_id, remote_etag, remote_updated, local_fingerprint
FROM google_calendar_mapping`).all<StoredMapping>();
  return result.results;
};

const upsertMapping = (mapping: StoredMapping, database: GoogleCalendarDatabase) => database.prepare(`INSERT INTO google_calendar_mapping (local_row_id, calendar_id, remote_event_id, remote_etag, remote_updated, local_fingerprint)
VALUES (?, ?, ?, ?, ?, ?)
ON CONFLICT(local_row_id) DO UPDATE SET calendar_id = excluded.calendar_id, remote_event_id = excluded.remote_event_id, remote_etag = excluded.remote_etag, remote_updated = excluded.remote_updated, local_fingerprint = excluded.local_fingerprint, updated_at = CURRENT_TIMESTAMP`).bind(
  mapping.local_row_id,
  mapping.calendar_id,
  mapping.remote_event_id,
  mapping.remote_etag,
  mapping.remote_updated,
  mapping.local_fingerprint,
);

const deleteMapping = (database: GoogleCalendarDatabase, localRowId: string) => database.prepare(`DELETE FROM google_calendar_mapping WHERE local_row_id = ?`).bind(localRowId);
const replaceDatabase = (items: Item[], nextDatabase: Database) => items.map((item) => item.id === nextDatabase.id ? nextDatabase : item);

const calendarForRow = (row: Row, calendars: GoogleCalendar[], mapping?: StoredMapping) => {
  if (mapping) return calendars.find((calendar) => calendar.id === mapping.calendar_id) || null;
  const id = textValue(row, GOOGLE_CALENDAR_PROPERTY_IDS.calendarId).trim();
  if (id) return calendars.find((calendar) => calendar.id === id) || null;
  const title = textValue(row, GOOGLE_CALENDAR_PROPERTY_IDS.calendar).trim();
  if (title) return calendars.find((calendar) => calendar.summary === title) || null;
  return calendars[0] || null;
};

const syncWorkspace = async (database: GoogleCalendarDatabase, items: Item[], baseRevision: number, env: GoogleCalendarEnv, guard: SyncGuard) => {
  const current = await loadWorkspace(database);
  if (current.revision !== baseRevision) return { conflict: current } as const;
  const token = await getGoogleAccessToken(database, env);
  const calendars = (await listCalendars(token)).filter(isCalendarWriter);
  if (!calendars.length) throw new GoogleCalendarError("No writable Google calendars were found", 400);
  const remoteGroups = await Promise.all(calendars.map(async (calendar) => ({ calendar, events: await listEvents(token, calendar.id) })));
  const storedMappings = await readMappings(database);
  const mappingByLocal = new Map(storedMappings.map((entry) => [entry.local_row_id, entry]));
  let nextItems = [...items];
  let calendarDatabase = nextItems.find((item): item is Database => item.id === GOOGLE_CALENDAR_DATABASE_ID && item.kind === "database");
  if (!calendarDatabase) {
    calendarDatabase = createGoogleCalendarDatabase();
    nextItems = [...nextItems, calendarDatabase];
  }
  const rows = new Map(calendarDatabase.rows.map((row) => [row.id, row]));
  for (const receipt of await readCreateReceipts(database, "calendar")) {
    let resultJson = receipt.result_json;
    if (!resultJson) {
      const group = remoteGroups.find(({ calendar }) => calendar.id === receipt.container_id);
      const mapped = new Set(storedMappings.filter((entry) => entry.calendar_id === receipt.container_id).map((entry) => entry.remote_event_id));
      const observed = new Set(JSON.parse(receipt.observed_ids_json) as string[]);
      const candidates = group?.events.filter((event) => event.status !== "cancelled" && !mapped.has(event.id) && !observed.has(event.id) && JSON.stringify(googleCalendarPayload(googleCalendarToRow(event, group.calendar))) === receipt.payload_json) || [];
      if (candidates.length !== 1) throw new GoogleSyncSafetyError("sync_uncertain");
      resultJson = JSON.stringify(candidates[0]);
      await database.prepare("UPDATE google_sync_creates SET result_json = ? WHERE operation_key = ?").bind(resultJson, receipt.operation_key).run();
    }
    const event = JSON.parse(resultJson) as GoogleCalendarEvent;
    const row = rows.get(receipt.local_row_id);
    if (!row) {
      await guard.check();
      await deleteEvent(token, receipt.container_id, event.id);
      const group = remoteGroups.find(({ calendar }) => calendar.id === receipt.container_id);
      const index = group?.events.findIndex((entry) => entry.id === event.id) ?? -1;
      if (group && index >= 0) group.events.splice(index, 1);
      await database.batch([deleteMapping(database, receipt.local_row_id), database.prepare("DELETE FROM google_sync_creates WHERE operation_key = ?").bind(receipt.operation_key)]);
      continue;
    }
    if (mappingByLocal.has(row.id) || textValue(row, GOOGLE_CALENDAR_PROPERTY_IDS.id) !== receipt.replaces_id) continue;
    const mapping: StoredMapping = { local_row_id: row.id, calendar_id: receipt.container_id, remote_event_id: event.id, remote_etag: event.etag || "", remote_updated: event.updated || "", local_fingerprint: calendarRowFingerprint(googleCalendarToRow(event, { id: receipt.container_id }, row)) };
    await upsertMapping(mapping, database).run();
    storedMappings.push(mapping);
    mappingByLocal.set(row.id, mapping);
  }
  // The list endpoint has a date window. Absence from that window does not mean
  // deletion: look up linked events before deciding to recreate or remove one.
  for (const group of remoteGroups) {
    const listed = new Set(group.events.map((event) => event.id));
    for (const mapping of storedMappings) {
      if (mapping.calendar_id !== group.calendar.id || listed.has(mapping.remote_event_id)) continue;
      await guard.check();
      try {
        group.events.push(await apiJson<GoogleCalendarEvent>(`${CALENDAR_API_URL}/calendars/${encodeURIComponent(group.calendar.id)}/events/${encodeURIComponent(mapping.remote_event_id)}`, token));
      } catch (error) {
        if (!(error instanceof GoogleCalendarError) || (error.status !== 404 && error.status !== 410)) throw error;
        group.events.push({ id: mapping.remote_event_id, status: "cancelled" });
      }
    }
  }
  const rowsByCalendar = new Map<string, Row[]>();
  calendarDatabase.rows.forEach((row) => {
    const calendar = calendarForRow(row, calendars, mappingByLocal.get(row.id));
    if (!calendar) return;
    const currentRows = rowsByCalendar.get(calendar.id) || [];
    currentRows.push(row);
    rowsByCalendar.set(calendar.id, currentRows);
  });
  const statements: GoogleTasksStatement[] = [];
  const absentRemotes = new Set<string>();
  const summary: GoogleCalendarSyncSummary = { imported: 0, exported: 0, updated: 0, removed: 0, conflicts: 0, calendarCount: calendars.length };

  for (const group of remoteGroups) {
    const { calendar, events } = group;
    const localRows = rowsByCalendar.get(calendar.id) || [];
    const rowByRemote = new Map(localRows
      .map((row) => [remoteKey(calendar.id, textValue(row, GOOGLE_CALENDAR_PROPERTY_IDS.id)), row] as const)
      .filter(([, row]) => Boolean(textValue(row, GOOGLE_CALENDAR_PROPERTY_IDS.id))));
    const remoteById = new Map(events.map((event) => [event.id, event]));
    const mappingsByRemote = new Map(storedMappings.filter((mapping) => mapping.calendar_id === calendar.id).map((mapping) => [remoteKey(mapping.calendar_id, mapping.remote_event_id), mapping]));

    const saveMapping = (row: Row, event: GoogleCalendarEvent) => {
      statements.push(upsertMapping({
        local_row_id: row.id,
        calendar_id: calendar.id,
        remote_event_id: event.id,
        remote_etag: event.etag || "",
        remote_updated: event.updated || new Date().toISOString(),
        local_fingerprint: calendarRowFingerprint(row),
      }, database));
    };

    const pushLocal = async (row: Row, event: GoogleCalendarEvent | undefined, conflict: boolean) => {
      const payload = googleCalendarPayload(row);
      if (!payload) return false;
      await guard.check();
      const result = event
        ? await updateEvent(token, calendar.id, event.id, payload)
        : await createRemoteOnce({ database, guard, service: "calendar", localRowId: row.id, containerId: calendar.id,
            replacesId: mappingByLocal.get(row.id)?.remote_event_id,
            payload,
            observedIds: events.filter((entry) => JSON.stringify(googleCalendarPayload(googleCalendarToRow(entry, calendar))) === JSON.stringify(payload)).map((entry) => entry.id),
            create: () => insertEvent(token, calendar.id, payload),
            mapping: (created) => upsertMapping({ local_row_id: row.id, calendar_id: calendar.id, remote_event_id: created.id, remote_etag: created.etag || "", remote_updated: created.updated || "", local_fingerprint: calendarRowFingerprint(googleCalendarToRow(created, calendar, row)) }, database),
          });
      const nextRow = googleCalendarToRow(result, calendar, row);
      rows.set(row.id, nextRow);
      saveMapping(nextRow, result);
      if (event) summary.updated += 1;
      else summary.exported += 1;
      if (conflict) summary.conflicts += 1;
      return true;
    };

    for (const event of events) {
      const mapping = mappingsByRemote.get(remoteKey(calendar.id, event.id));
      const existing = (mapping && rows.get(mapping.local_row_id)) || rowByRemote.get(remoteKey(calendar.id, event.id));
      if (mapping && !existing) {
        if (event.status !== "cancelled") { await guard.check(); await deleteEvent(token, calendar.id, event.id); }
        absentRemotes.add(remoteKey(calendar.id, event.id));
        statements.push(deleteMapping(database, mapping.local_row_id));
        summary.removed += 1;
        continue;
      }
      if (event.status === "cancelled") {
        if (!existing) continue;
        const localChanged = mapping ? calendarRowFingerprint(existing) !== mapping.local_fingerprint : true;
        if (localChanged && await pushLocal(existing, undefined, true)) continue;
        rows.delete(existing.id);
        absentRemotes.add(remoteKey(calendar.id, event.id));
        statements.push(deleteMapping(database, existing.id));
        summary.removed += 1;
        continue;
      }
      if (!existing) {
        const imported = googleCalendarToRow(event, calendar);
        rows.set(imported.id, imported);
        saveMapping(imported, event);
        summary.imported += 1;
        continue;
      }
      const localChanged = mapping ? calendarRowFingerprint(existing) !== mapping.local_fingerprint : false;
      const remoteChanged = mapping ? event.updated !== mapping.remote_updated || event.etag !== mapping.remote_etag : true;
      if (localChanged) {
        await pushLocal(existing, event, remoteChanged);
      } else {
        const nextRow = remoteChanged ? googleCalendarToRow(event, calendar, existing) : existing;
        rows.set(existing.id, nextRow);
        saveMapping(nextRow, event);
        if (remoteChanged && mapping) summary.updated += 1;
      }
    }

    for (const row of localRows) {
      const mapping = mappingByLocal.get(row.id);
      if (mapping && mapping.calendar_id === calendar.id && !remoteById.has(mapping.remote_event_id)) {
        const localChanged = calendarRowFingerprint(row) !== mapping.local_fingerprint;
        if (localChanged && await pushLocal(row, undefined, true)) continue;
        rows.delete(row.id);
        absentRemotes.add(remoteKey(mapping.calendar_id, mapping.remote_event_id));
        statements.push(deleteMapping(database, row.id));
        summary.removed += 1;
      } else if (!mapping && !textValue(row, GOOGLE_CALENDAR_PROPERTY_IDS.id)) {
        await pushLocal(row, undefined, false);
      }
    }
  }

  // A deleted local row still has a mapping until this pass, so its remote event
  // is deleted as well. This keeps deletion genuinely two-way.
  for (const mapping of storedMappings) {
    if (rows.has(mapping.local_row_id)) continue;
    if (!absentRemotes.has(remoteKey(mapping.calendar_id, mapping.remote_event_id))) {
      await guard.check();
      await deleteEvent(token, mapping.calendar_id, mapping.remote_event_id);
    }
    statements.push(deleteMapping(database, mapping.local_row_id));
    if (!absentRemotes.has(remoteKey(mapping.calendar_id, mapping.remote_event_id))) summary.removed += 1;
  }

  const updatedDatabase = { ...calendarDatabase, rows: [...rows.values()] };
  nextItems = replaceDatabase(nextItems, updatedDatabase);
  await guard.check();
  const saved = await saveWorkspace(database, nextItems, baseRevision);
  if (!saved.ok) return { conflict: saved.current } as const;
  statements.push(updateState(database, new Date().toISOString(), null));
  statements.push(database.prepare("DELETE FROM google_sync_creates WHERE service = 'calendar' AND result_json IS NOT NULL"));
  await database.batch(statements);
  return { workspace: saved.workspace, summary } as const;
};

type GoogleCalendarEnv = GoogleTasksEnv;

const status = async (env: GoogleCalendarEnv, database: GoogleCalendarDatabase): Promise<Response> => {
  const state = await readState(database);
  const stored = await database.prepare(`SELECT id FROM google_tasks_connection WHERE id = ?`).bind(STATE_ID).first<{ id: string }>();
  if (!stored) return json({ configured: isGoogleTasksConfigured(env), connected: false, calendars: [], lastSyncAt: state?.last_sync_at || null } satisfies GoogleCalendarStatus);
  if (!isGoogleTasksConfigured(env)) return json({ configured: false, connected: true, calendars: [], lastSyncAt: state?.last_sync_at || null } satisfies GoogleCalendarStatus);
  try {
    const calendars = (await listCalendars(await getGoogleAccessToken(database, env))).filter(isCalendarWriter);
    return json({ configured: true, connected: true, calendars: calendars.map((calendar) => ({ id: calendar.id, title: calendar.summary || calendar.id, primary: Boolean(calendar.primary) })), lastSyncAt: state?.last_sync_at || null, error: state?.last_error || undefined } satisfies GoogleCalendarStatus);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google authorization has expired";
    await updateState(database, state?.last_sync_at || null, message).run();
    return json({ configured: true, connected: true, needsReconnect: true, calendars: [], lastSyncAt: state?.last_sync_at || null, error: message } satisfies GoogleCalendarStatus);
  }
};

export const handleGoogleCalendarApi = async (request: Request, env: GoogleCalendarEnv, url: URL): Promise<Response | null> => {
  if (!url.pathname.startsWith("/api/google-calendar/")) return null;
  if (!env.DB) return json({ error: "D1 database is not configured" }, 503);
  const database = env.DB as GoogleCalendarDatabase;
  await ensureCalendarSchema(database);
  try {
    if (url.pathname === "/api/google-calendar/connect" && request.method === "GET") {
      const target = new URL("/api/google-tasks/connect", request.url);
      target.searchParams.set("return", "calendar");
      return Response.redirect(target.toString(), 302);
    }
    if (url.pathname === "/api/google-calendar/status" && request.method === "GET") return await status(env, database);
    if (url.pathname === "/api/google-calendar/disconnect" && request.method === "POST") {
      await database.batch([
        database.prepare("DELETE FROM google_calendar_mapping"),
        updateState(database, null, null),
      ]);
      return json({ ok: true });
    }
    if (url.pathname === "/api/google-calendar/sync" && request.method === "POST") {
      if (!isGoogleTasksConfigured(env)) return json({ error: "Google Calendar integration is not configured" }, 503);
      const body = await request.json().catch(() => null) as { items?: unknown; baseRevision?: unknown } | null;
      if (!body || !isWorkspaceItems(body.items) || !Number.isInteger(body.baseRevision) || Number(body.baseRevision) < 1) {
        return json({ error: "Invalid Google Calendar sync payload" }, 400);
      }
      const result = await withGoogleSyncLock(database, (guard) => syncWorkspace(database, body.items as Item[], Number(body.baseRevision), env, guard));
      if ("conflict" in result) return json({ error: "Workspace changed in another tab", workspace: result.conflict }, 409);
      return json({ workspace: result.workspace, sync: result.summary });
    }
    return new Response(null, { status: 405, headers: { Allow: "GET, POST" } });
  } catch (error) {
    if (error instanceof GoogleSyncSafetyError) return json({ error: error.message, code: error.code }, error.status);
    const message = error instanceof Error ? error.message : "Google Calendar is temporarily unavailable";
    await updateState(database, (await readState(database))?.last_sync_at || null, message).run();
    if (error instanceof GoogleCalendarError) return json({ error: message }, error.status >= 400 && error.status < 600 ? error.status : 500);
    console.error("Google Calendar API failed", error);
    return json({ error: message }, 500);
  }
};
