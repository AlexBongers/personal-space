import { createGoogleTasksDatabase, GOOGLE_TASKS_DATABASE_ID } from "../app/personal-space/model.ts";
import type { Database, Item, Row } from "../app/personal-space/types.ts";
import {
  googleRowFingerprint,
  googleTaskId,
  googleTaskPayload,
  googleTaskToRow,
  type GoogleTask,
  type GoogleTaskPayload,
} from "./google-tasks-sync.ts";
import { isWorkspaceItems, loadWorkspace, saveWorkspace, type D1RunResult } from "./workspace-store.ts";
import { createRemoteOnce, GoogleSyncSafetyError, readCreateReceipts, withGoogleSyncLock, type SyncGuard } from "./google-sync-guard.ts";

const CONNECTION_ID = "primary";
// Gmail read access is requested only when connecting the inbox. All Google
// integrations share the existing encrypted refresh token and callback.
export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
export const GOOGLE_SCOPE = [
  "https://www.googleapis.com/auth/tasks",
  "https://www.googleapis.com/auth/calendar",
].join(" ");
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_TASKS_URL = "https://tasks.googleapis.com/tasks/v1";
const STATE_COOKIE = "personal_space_google_tasks_state";
const RETURN_COOKIE = "personal_space_google_return";

export interface GoogleTasksStatement {
  bind(...values: unknown[]): GoogleTasksStatement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
  run(): Promise<D1RunResult>;
}

export interface GoogleTasksDatabase {
  prepare(query: string): GoogleTasksStatement;
  batch(statements: GoogleTasksStatement[]): Promise<unknown[]>;
}

export interface GoogleTasksEnv {
  DB?: GoogleTasksDatabase;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_REDIRECT_URI?: string;
  GOOGLE_TOKEN_ENCRYPTION_KEY?: string;
}

type StoredConnection = {
  id: string;
  refresh_token: string;
  task_list_id: string | null;
  task_list_title: string | null;
  last_sync_at: string | null;
  last_error: string | null;
};

type StoredMapping = {
  local_row_id: string;
  task_list_id: string;
  remote_task_id: string;
  remote_etag: string;
  remote_updated: string;
  local_fingerprint: string;
};

type GoogleTaskList = { id: string; title: string };
type GoogleCollection<T> = { items?: T[]; nextPageToken?: string };

export type GoogleTasksStatus = {
  configured: boolean;
  connected: boolean;
  needsReconnect?: boolean;
  syncAllTaskLists: boolean;
  taskLists: GoogleTaskList[];
  selectedTaskListId: string | null;
  selectedTaskListTitle: string | null;
  lastSyncAt: string | null;
  error?: string;
};

export type GoogleTasksSyncSummary = {
  imported: number;
  exported: number;
  updated: number;
  removed: number;
  conflicts: number;
  taskListTitle: string;
  taskListCount: number;
};

class GoogleTasksError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.name = "GoogleTasksError";
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

const text = (body: string, status = 200) => new Response(body, {
  status,
  headers: {
    "Cache-Control": "no-store",
    "Content-Type": "text/plain; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
  },
});

export const isGoogleTasksConfigured = (env: GoogleTasksEnv) => Boolean(
  env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_TOKEN_ENCRYPTION_KEY,
);

const redirectUri = (request: Request, env: GoogleTasksEnv) =>
  env.GOOGLE_REDIRECT_URI || new URL("/api/google-tasks/callback", request.url).toString();

const parseCookies = (header: string | null) => Object.fromEntries(
  (header || "").split(";").map((part) => part.trim().split("=")).filter(([key, value]) => key && value)
    .map(([key, ...values]) => [key, values.join("=")]),
);

const base64Url = (bytes: Uint8Array) => {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const bytesFromBase64Url = (value: string) => {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

const makeState = () => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
};

const stateCookie = (state: string) => `${STATE_COOKIE}=${state}; Max-Age=600; Path=/api/google-tasks; HttpOnly; Secure; SameSite=Lax`;
const returnCookie = (service: "tasks" | "calendar" | "gmail") => `${RETURN_COOKIE}=${service}; Max-Age=600; Path=/api/google-tasks; HttpOnly; Secure; SameSite=Lax`;
const clearStateCookie = () => `${STATE_COOKIE}=; Max-Age=0; Path=/api/google-tasks; HttpOnly; Secure; SameSite=Lax`;
const clearReturnCookie = () => `${RETURN_COOKIE}=; Max-Age=0; Path=/api/google-tasks; HttpOnly; Secure; SameSite=Lax`;

const encryptionKey = async (env: GoogleTasksEnv) => {
  if (!env.GOOGLE_TOKEN_ENCRYPTION_KEY) throw new GoogleTasksError("Google token encryption is not configured", 503);
  const keyBytes = bytesFromBase64Url(env.GOOGLE_TOKEN_ENCRYPTION_KEY);
  if (keyBytes.byteLength !== 32) throw new GoogleTasksError("Google token encryption key must contain 32 bytes", 503);
  return crypto.subtle.importKey("raw", keyBytes.buffer as ArrayBuffer, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
};

const encryptToken = async (value: string, env: GoogleTasksEnv) => {
  const key = await encryptionKey(env);
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(value));
  const result = new Uint8Array(iv.byteLength + encrypted.byteLength);
  result.set(iv);
  result.set(new Uint8Array(encrypted), iv.byteLength);
  return base64Url(result);
};

const decryptToken = async (value: string, env: GoogleTasksEnv) => {
  const key = await encryptionKey(env);
  const encrypted = bytesFromBase64Url(value);
  if (encrypted.byteLength <= 12) throw new GoogleTasksError("Stored Google token is invalid", 500);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: encrypted.slice(0, 12) },
    key,
    encrypted.slice(12).buffer as ArrayBuffer,
  );
  return new TextDecoder().decode(decrypted);
};

const connection = (database: GoogleTasksDatabase) => database.prepare(`SELECT id, refresh_token, task_list_id, task_list_title, last_sync_at, last_error
FROM google_tasks_connection
WHERE id = ?`).bind(CONNECTION_ID).first<StoredConnection>();

const recordConnectionError = async (database: GoogleTasksDatabase, message: string) => {
  await database.prepare(`UPDATE google_tasks_connection
SET last_error = ?, updated_at = CURRENT_TIMESTAMP
WHERE id = ?`).bind(message.slice(0, 500), CONNECTION_ID).run();
};

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
      ? String((parsed as { error?: { message?: string } }).error?.message || "Google Tasks request failed")
      : `Google Tasks request failed (${response.status})`;
    throw new GoogleTasksError(message, response.status);
  }
  return parsed as T;
};

const accessToken = async (stored: StoredConnection, env: GoogleTasksEnv, signal?: AbortSignal) => {
  const refreshToken = await decryptToken(stored.refresh_token, env);
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    signal: signal || AbortSignal.timeout(15000),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID || "",
      client_secret: env.GOOGLE_CLIENT_SECRET || "",
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const body = await response.json().catch(() => null) as { access_token?: string; error_description?: string } | null;
  if (!response.ok || !body?.access_token) {
    throw new GoogleTasksError(body?.error_description || "Google authorization has expired", response.status || 401);
  }
  return body.access_token;
};

export const getGoogleAccessToken = async (database: GoogleTasksDatabase, env: GoogleTasksEnv, signal?: AbortSignal) => {
  const stored = await connection(database);
  if (!stored) throw new GoogleTasksError("Google is not connected", 401);
  return accessToken(stored, env, signal);
};

const listTaskLists = async (token: string) => {
  const lists: GoogleTaskList[] = [];
  let pageToken = "";
  do {
    const query = new URLSearchParams({ maxResults: "1000" });
    if (pageToken) query.set("pageToken", pageToken);
    const result = await apiJson<GoogleCollection<GoogleTaskList>>(`${GOOGLE_TASKS_URL}/users/@me/lists?${query}`, token);
    lists.push(...(result.items || []));
    pageToken = result.nextPageToken || "";
  } while (pageToken);
  return lists;
};

const listTasks = async (token: string, taskListId: string) => {
  const tasks: GoogleTask[] = [];
  let pageToken = "";
  do {
    const query = new URLSearchParams({
      maxResults: "100",
      showCompleted: "true",
      showDeleted: "true",
      showHidden: "true",
    });
    if (pageToken) query.set("pageToken", pageToken);
    const result = await apiJson<GoogleCollection<GoogleTask>>(`${GOOGLE_TASKS_URL}/lists/${encodeURIComponent(taskListId)}/tasks?${query}`, token);
    tasks.push(...(result.items || []));
    pageToken = result.nextPageToken || "";
  } while (pageToken);
  return tasks;
};

const insertTask = (token: string, taskListId: string, payload: GoogleTaskPayload) => apiJson<GoogleTask>(
  `${GOOGLE_TASKS_URL}/lists/${encodeURIComponent(taskListId)}/tasks`,
  token,
  {
    method: "POST",
    body: JSON.stringify({
      title: payload.title,
      status: payload.status,
      ...(payload.notes ? { notes: payload.notes } : {}),
      ...(payload.due ? { due: payload.due } : {}),
    }),
  },
);

const patchTask = (token: string, taskListId: string, taskId: string, payload: GoogleTaskPayload) => apiJson<GoogleTask>(
  `${GOOGLE_TASKS_URL}/lists/${encodeURIComponent(taskListId)}/tasks/${encodeURIComponent(taskId)}`,
  token,
  { method: "PATCH", body: JSON.stringify(payload) },
);

const deleteTask = async (token: string, taskListId: string, taskId: string) => {
  try {
    await apiJson<null>(`${GOOGLE_TASKS_URL}/lists/${encodeURIComponent(taskListId)}/tasks/${encodeURIComponent(taskId)}`, token, { method: "DELETE" });
  } catch (error) {
    if (!(error instanceof GoogleTasksError) || error.status !== 404) throw error;
  }
};

const readMappings = async (database: GoogleTasksDatabase) => {
  const result = await database.prepare(`SELECT local_row_id, task_list_id, remote_task_id, remote_etag, remote_updated, local_fingerprint
FROM google_tasks_mapping
`).all<StoredMapping>();
  return result.results;
};

const upsertMapping = (mapping: StoredMapping, database: GoogleTasksDatabase) => database.prepare(`INSERT INTO google_tasks_mapping (local_row_id, task_list_id, remote_task_id, remote_etag, remote_updated, local_fingerprint)
VALUES (?, ?, ?, ?, ?, ?)
ON CONFLICT(local_row_id) DO UPDATE SET task_list_id = excluded.task_list_id, remote_task_id = excluded.remote_task_id, remote_etag = excluded.remote_etag, remote_updated = excluded.remote_updated, local_fingerprint = excluded.local_fingerprint, updated_at = CURRENT_TIMESTAMP`).bind(
  mapping.local_row_id,
  mapping.task_list_id,
  mapping.remote_task_id,
  mapping.remote_etag,
  mapping.remote_updated,
  mapping.local_fingerprint,
);

const deleteMapping = (database: GoogleTasksDatabase, localRowId: string) => database.prepare(`DELETE FROM google_tasks_mapping
WHERE local_row_id = ?`).bind(localRowId);

const textValue = (row: Row, id: string) => {
  const value = row.values[id];
  return Array.isArray(value) ? value.join(", ") : value === null || value === undefined ? "" : String(value);
};

const remoteKey = (taskListId: string, remoteTaskId: string) => `${taskListId}\u0000${remoteTaskId}`;

const listsByTitle = (taskLists: GoogleTaskList[]) => {
  const result = new Map<string, GoogleTaskList[]>();
  taskLists.forEach((taskList) => {
    const matches = result.get(taskList.title) || [];
    matches.push(taskList);
    result.set(taskList.title, matches);
  });
  return result;
};

const replaceDatabase = (items: Item[], nextDatabase: Database) => items.map((item) => item.id === nextDatabase.id ? nextDatabase : item);

const syncWorkspace = async (
  database: GoogleTasksDatabase,
  items: Item[],
  baseRevision: number,
  env: GoogleTasksEnv,
  guard: SyncGuard,
) => {
  const current = await loadWorkspace(database);
  if (current.revision !== baseRevision) return { conflict: current } as const;
  const stored = await connection(database);
  if (!stored) throw new GoogleTasksError("Google Tasks is not connected", 401);
  const token = await accessToken(stored, env);
  const taskLists = await listTaskLists(token);
  if (!taskLists.length) throw new GoogleTasksError("Create a task list in Google Tasks first", 400);
  const remoteGroups: Array<{ list: GoogleTaskList; tasks: GoogleTask[] }> = [];
  const remoteTaskKeys = new Set<string>();
  const remoteListsByTaskId = new Map<string, GoogleTaskList[]>();
  for (const list of taskLists) {
    const tasks = await listTasks(token, list.id);
    remoteGroups.push({ list, tasks });
    tasks.forEach((task) => {
      if (!task.id) return;
      remoteTaskKeys.add(remoteKey(list.id, task.id));
      const matches = remoteListsByTaskId.get(task.id) || [];
      matches.push(list);
      remoteListsByTaskId.set(task.id, matches);
    });
  }
  const storedMappings = await readMappings(database);
  const mappingByLocal = new Map(storedMappings.map((entry) => [entry.local_row_id, entry]));
  let nextItems = [...items];
  let taskDatabase = nextItems.find((item): item is Database => item.id === GOOGLE_TASKS_DATABASE_ID && item.kind === "database");
  if (!taskDatabase) {
    taskDatabase = createGoogleTasksDatabase();
    nextItems = [...nextItems, taskDatabase];
  }
  const rows = new Map(taskDatabase.rows.map((row) => [row.id, row]));
  for (const receipt of await readCreateReceipts(database, "tasks")) {
    let resultJson = receipt.result_json;
    if (!resultJson) {
      const group = remoteGroups.find(({ list }) => list.id === receipt.container_id);
      const mapped = new Set(storedMappings.filter((entry) => entry.task_list_id === receipt.container_id).map((entry) => entry.remote_task_id));
      const observed = new Set(JSON.parse(receipt.observed_ids_json) as string[]);
      const candidates = group?.tasks.filter((task) => !task.deleted && !mapped.has(task.id) && !observed.has(task.id) && JSON.stringify(googleTaskPayload(googleTaskToRow(task, group.list.title))) === receipt.payload_json) || [];
      if (candidates.length !== 1) throw new GoogleSyncSafetyError("sync_uncertain");
      resultJson = JSON.stringify(candidates[0]);
      await database.prepare("UPDATE google_sync_creates SET result_json = ? WHERE operation_key = ?").bind(resultJson, receipt.operation_key).run();
    }
    const task = JSON.parse(resultJson) as GoogleTask;
    const row = rows.get(receipt.local_row_id);
    if (!row) {
      await guard.check();
      await deleteTask(token, receipt.container_id, task.id);
      const group = remoteGroups.find(({ list }) => list.id === receipt.container_id);
      const index = group?.tasks.findIndex((entry) => entry.id === task.id) ?? -1;
      if (group && index >= 0) group.tasks.splice(index, 1);
      await database.batch([deleteMapping(database, receipt.local_row_id), database.prepare("DELETE FROM google_sync_creates WHERE operation_key = ?").bind(receipt.operation_key)]);
      continue;
    }
    if (mappingByLocal.has(row.id) || googleTaskId(row) !== receipt.replaces_id) continue;
    const mapping: StoredMapping = { local_row_id: row.id, task_list_id: receipt.container_id, remote_task_id: task.id, remote_etag: task.etag || "", remote_updated: task.updated || "", local_fingerprint: googleRowFingerprint(googleTaskToRow(task, "", row)) };
    await upsertMapping(mapping, database).run();
    storedMappings.push(mapping);
    mappingByLocal.set(row.id, mapping);
  }
  const titleLists = listsByTitle(taskLists);
  const defaultList = taskLists[0];
  const rowsByList = new Map<string, Row[]>();
  const listForRow = (row: Row) => {
    const mapping = mappingByLocal.get(row.id);
    if (mapping) return taskLists.find((list) => list.id === mapping.task_list_id) || null;
    const taskId = googleTaskId(row);
    const title = textValue(row, "google-list").trim();
    if (taskId) {
      const titleMatches = (titleLists.get(title) || []).filter((list) => remoteTaskKeys.has(remoteKey(list.id, taskId)));
      if (titleMatches.length) return titleMatches[0];
      const remoteMatches = remoteListsByTaskId.get(taskId) || [];
      if (remoteMatches.length === 1) return remoteMatches[0];
    }
    if (title) return (titleLists.get(title) || [])[0] || null;
    if (!taskId) return defaultList;
    return null;
  };
  taskDatabase.rows.forEach((row) => {
    const list = listForRow(row);
    if (!list) return;
    const listRows = rowsByList.get(list.id) || [];
    listRows.push(row);
    rowsByList.set(list.id, listRows);
  });
  const mappingStatements: GoogleTasksStatement[] = [];
  const summary: GoogleTasksSyncSummary = {
    imported: 0,
    exported: 0,
    updated: 0,
    removed: 0,
    conflicts: 0,
    taskListTitle: taskLists.length === 1 ? taskLists[0].title : "All lists",
    taskListCount: taskLists.length,
  };

  for (const group of remoteGroups) {
    const { list, tasks } = group;
    const localRows = rowsByList.get(list.id) || [];
    const rowByRemote = new Map(localRows
      .map((row) => [remoteKey(list.id, googleTaskId(row)), row] as const)
      .filter(([, row]) => Boolean(googleTaskId(row))));
    const remoteById = new Map(tasks.map((task) => [task.id, task]));
    const listMappingByRemote = new Map(storedMappings.filter((mapping) => mapping.task_list_id === list.id).map((mapping) => [remoteKey(mapping.task_list_id, mapping.remote_task_id), mapping]));

    const saveMapping = (row: Row, task: GoogleTask) => {
      mappingStatements.push(upsertMapping({
        local_row_id: row.id,
        task_list_id: list.id,
        remote_task_id: task.id,
        remote_etag: task.etag || "",
        remote_updated: task.updated || new Date().toISOString(),
        local_fingerprint: googleRowFingerprint(row),
      }, database));
    };

    const pushLocal = async (row: Row, task: GoogleTask | undefined, conflict: boolean) => {
      await guard.check();
      const result = task
        ? await patchTask(token, list.id, task.id, googleTaskPayload(row))
        : await createRemoteOnce({ database, guard, service: "tasks", localRowId: row.id, containerId: list.id,
            replacesId: mappingByLocal.get(row.id)?.remote_task_id,
            payload: googleTaskPayload(row),
            observedIds: tasks.filter((entry) => JSON.stringify(googleTaskPayload(googleTaskToRow(entry, list.title))) === googleRowFingerprint(row)).map((entry) => entry.id),
            create: () => insertTask(token, list.id, googleTaskPayload(row)),
            mapping: (created) => upsertMapping({ local_row_id: row.id, task_list_id: list.id, remote_task_id: created.id, remote_etag: created.etag || "", remote_updated: created.updated || "", local_fingerprint: googleRowFingerprint(googleTaskToRow(created, list.title, row)) }, database),
          });
      const nextRow = googleTaskToRow(result, list.title, row);
      rows.set(row.id, nextRow);
      saveMapping(nextRow, result);
      if (task) summary.updated += 1;
      else summary.exported += 1;
      if (conflict) summary.conflicts += 1;
    };

    for (const task of tasks) {
      const mapping = listMappingByRemote.get(remoteKey(list.id, task.id));
      const existing = (mapping && rows.get(mapping.local_row_id)) || rowByRemote.get(remoteKey(list.id, task.id));
      if (mapping && !existing) {
        if (!task.deleted) { await guard.check(); await deleteTask(token, list.id, task.id); }
        mappingStatements.push(deleteMapping(database, mapping.local_row_id));
        summary.removed += 1;
        continue;
      }
      if (task.deleted) {
        if (!existing) continue;
        const localChanged = mapping ? googleRowFingerprint(existing) !== mapping.local_fingerprint : true;
        if (localChanged) {
          await pushLocal(existing, undefined, true);
        } else {
          rows.delete(existing.id);
          mappingStatements.push(deleteMapping(database, existing.id));
          summary.removed += 1;
        }
        continue;
      }
      if (!existing) {
        const imported = googleTaskToRow(task, list.title);
        rows.set(imported.id, imported);
        saveMapping(imported, task);
        summary.imported += 1;
        continue;
      }
      const localChanged = mapping ? googleRowFingerprint(existing) !== mapping.local_fingerprint : false;
      const remoteChanged = mapping ? task.updated !== mapping.remote_updated || task.etag !== mapping.remote_etag : true;
      if (localChanged) {
        await pushLocal(existing, task, remoteChanged);
      } else {
        const nextRow = remoteChanged ? googleTaskToRow(task, list.title, existing) : existing;
        rows.set(existing.id, nextRow);
        saveMapping(nextRow, task);
        if (remoteChanged && mapping) summary.updated += 1;
      }
    }

    for (const row of localRows) {
      const mapping = mappingByLocal.get(row.id);
      if (mapping && mapping.task_list_id === list.id && !remoteById.has(mapping.remote_task_id)) {
        await guard.check();
        await deleteTask(token, list.id, mapping.remote_task_id);
        rows.delete(row.id);
        mappingStatements.push(deleteMapping(database, row.id));
        summary.removed += 1;
        continue;
      }
      if (!mapping && !googleTaskId(row)) await pushLocal(row, undefined, false);
    }
  }

  const updatedDatabase = { ...taskDatabase, rows: [...rows.values()] };
  nextItems = replaceDatabase(nextItems, updatedDatabase);
  await guard.check();
  const saved = await saveWorkspace(database, nextItems, baseRevision);
  if (!saved.ok) return { conflict: saved.current } as const;
  const connectionUpdate = database.prepare(`UPDATE google_tasks_connection
SET task_list_id = NULL, task_list_title = ?, last_sync_at = CURRENT_TIMESTAMP, last_error = NULL, updated_at = CURRENT_TIMESTAMP
WHERE id = ?`).bind(summary.taskListTitle, CONNECTION_ID);
  const clearReceipts = database.prepare("DELETE FROM google_sync_creates WHERE service = 'tasks' AND result_json IS NOT NULL");
  await database.batch([...mappingStatements, connectionUpdate, clearReceipts]);
  return { workspace: saved.workspace, summary } as const;
};

const startConnect = (request: Request, env: GoogleTasksEnv) => {
  if (!isGoogleTasksConfigured(env)) return json({ error: "Google Tasks integration is not configured" }, 503);
  const state = makeState();
  const requestedService = new URL(request.url).searchParams.get("return");
  const returnService = requestedService === "gmail" ? "gmail" : requestedService === "calendar" ? "calendar" : "tasks";
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID || "",
    redirect_uri: redirectUri(request, env),
    response_type: "code",
    scope: returnService === "gmail" ? `${GOOGLE_SCOPE} ${GMAIL_SCOPE}` : GOOGLE_SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  const headers = new Headers({ Location: `${GOOGLE_AUTH_URL}?${params}` });
  headers.append("Set-Cookie", stateCookie(state));
  headers.append("Set-Cookie", returnCookie(returnService));
  return new Response(null, { status: 302, headers });
};

const callback = async (request: Request, env: GoogleTasksEnv, database: GoogleTasksDatabase) => {
  if (!isGoogleTasksConfigured(env)) return text("Google Tasks integration is not configured", 503);
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const cookies = parseCookies(request.headers.get("Cookie"));
  const headers = new Headers();
  headers.append("Set-Cookie", clearStateCookie());
  headers.append("Set-Cookie", clearReturnCookie());
  if (!state || state !== cookies[STATE_COOKIE]) return new Response("Google authorization could not be verified", { status: 400, headers });
  const returnService = cookies[RETURN_COOKIE] === "gmail" ? "gmail" : cookies[RETURN_COOKIE] === "calendar" ? "calendar" : "tasks";
  if (!code || url.searchParams.has("error")) {
    headers.set("Location", `/?google=error&service=${returnService}`);
    return new Response(null, { status: 303, headers });
  }
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID || "",
      client_secret: env.GOOGLE_CLIENT_SECRET || "",
      redirect_uri: redirectUri(request, env),
      grant_type: "authorization_code",
    }),
  });
  const body = await response.json().catch(() => null) as { refresh_token?: string; scope?: string; error_description?: string } | null;
  if (returnService === "gmail" && response.ok && !body?.scope?.split(" ").includes(GMAIL_SCOPE)) {
    headers.set("Location", "/?google=error&service=gmail");
    return new Response(null, { status: 303, headers });
  }
  if (!response.ok || !body?.refresh_token) return new Response(body?.error_description || "Google authorization was not completed", { status: 502, headers });
  const encryptedToken = await encryptToken(body.refresh_token, env);
  await database.prepare(`INSERT INTO google_tasks_connection (id, refresh_token)
VALUES (?, ?)
ON CONFLICT(id) DO UPDATE SET refresh_token = excluded.refresh_token, last_error = NULL, updated_at = CURRENT_TIMESTAMP`).bind(CONNECTION_ID, encryptedToken).run();
  headers.set("Location", `/?google=connected&service=${returnService}`);
  return new Response(null, { status: 303, headers });
};

const status = async (env: GoogleTasksEnv, database: GoogleTasksDatabase): Promise<Response> => {
  const stored = await connection(database);
  if (!stored) return json({ configured: isGoogleTasksConfigured(env), connected: false, syncAllTaskLists: true, taskLists: [], selectedTaskListId: null, selectedTaskListTitle: null, lastSyncAt: null } satisfies GoogleTasksStatus);
  if (!isGoogleTasksConfigured(env)) return json({ configured: false, connected: true, syncAllTaskLists: true, taskLists: [], selectedTaskListId: null, selectedTaskListTitle: null, lastSyncAt: stored.last_sync_at } satisfies GoogleTasksStatus);
  try {
    const taskLists = await listTaskLists(await accessToken(stored, env));
    return json({ configured: true, connected: true, syncAllTaskLists: true, taskLists, selectedTaskListId: null, selectedTaskListTitle: null, lastSyncAt: stored.last_sync_at, error: stored.last_error || undefined } satisfies GoogleTasksStatus);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google authorization has expired";
    await recordConnectionError(database, message);
    return json({ configured: true, connected: true, syncAllTaskLists: true, needsReconnect: true, taskLists: [], selectedTaskListId: null, selectedTaskListTitle: null, lastSyncAt: stored.last_sync_at, error: message } satisfies GoogleTasksStatus);
  }
};

export const handleGoogleTasksApi = async (request: Request, env: GoogleTasksEnv, url: URL): Promise<Response | null> => {
  if (!url.pathname.startsWith("/api/google-tasks/")) return null;
  if (!env.DB) return json({ error: "D1 database is not configured" }, 503);
  const database = env.DB;
  try {
    if (url.pathname === "/api/google-tasks/connect" && request.method === "GET") return startConnect(request, env);
    if (url.pathname === "/api/google-tasks/callback" && request.method === "GET") return await callback(request, env, database);
    if (url.pathname === "/api/google-tasks/status" && request.method === "GET") return await status(env, database);
    if (url.pathname === "/api/google-tasks/disconnect" && request.method === "POST") {
      await database.batch([
        database.prepare("DELETE FROM google_tasks_mapping"),
        database.prepare("DELETE FROM google_tasks_connection WHERE id = ?").bind(CONNECTION_ID),
      ]);
      return json({ ok: true });
    }
    if (url.pathname === "/api/google-tasks/sync" && request.method === "POST") {
      if (!isGoogleTasksConfigured(env)) return json({ error: "Google Tasks integration is not configured" }, 503);
      const body = await request.json().catch(() => null) as { items?: unknown; baseRevision?: unknown } | null;
      if (!body || !isWorkspaceItems(body.items) || !Number.isInteger(body.baseRevision) || Number(body.baseRevision) < 1) {
        return json({ error: "Invalid Google Tasks sync payload" }, 400);
      }
      const result = await withGoogleSyncLock(database, (guard) => syncWorkspace(database, body.items as Item[], Number(body.baseRevision), env, guard));
      if ("conflict" in result) return json({ error: "Workspace changed in another tab", workspace: result.conflict }, 409);
      return json({ workspace: result.workspace, sync: result.summary });
    }
    return new Response(null, { status: 405, headers: { Allow: "GET, POST" } });
  } catch (error) {
    if (error instanceof GoogleSyncSafetyError) return json({ error: error.message, code: error.code }, error.status);
    const message = error instanceof Error ? error.message : "Google Tasks is temporarily unavailable";
    if (error instanceof GoogleTasksError) return json({ error: message }, error.status >= 400 && error.status < 600 ? error.status : 500);
    console.error("Google Tasks API failed", error);
    return json({ error: "Google Tasks is temporarily unavailable" }, 500);
  }
};
