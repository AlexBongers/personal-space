import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { createGoogleCalendarDatabase, GOOGLE_CALENDAR_PROPERTY_IDS as CAL } from "../app/personal-space/model.ts";
import type { Database, Item } from "../app/personal-space/types.ts";
import { handleGoogleCalendarApi, isSyncedCalendar, syncedCalendars } from "../worker/google-calendar.ts";
import type { GoogleTasksDatabase, GoogleTasksStatement } from "../worker/google-tasks.ts";

class TestDatabase implements GoogleTasksDatabase {
  sqlite = new DatabaseSync(":memory:");
  constructor() {
    const directory = new URL("../drizzle/", import.meta.url);
    for (const file of readdirSync(directory).filter((name) => name.endsWith(".sql")).sort()) this.sqlite.exec(readFileSync(new URL(file, directory), "utf8"));
  }
  prepare(query: string): GoogleTasksStatement {
    const statement = this.sqlite.prepare(query);
    let values: Array<string | number | null> = [];
    return {
      bind(...args: unknown[]) { values = args as typeof values; return this; },
      async first<T>() { return (statement.get(...values) ?? null) as T | null; },
      async all<T>() { return { results: statement.all(...values) as T[] }; },
      async run() { return { meta: { changes: Number(statement.run(...values).changes) } }; },
    };
  }
  async batch(statements: GoogleTasksStatement[]) {
    this.sqlite.exec("BEGIN");
    try { const results = []; for (const statement of statements) results.push(await statement.run()); this.sqlite.exec("COMMIT"); return results; }
    catch (error) { this.sqlite.exec("ROLLBACK"); throw error; }
  }
}

const BIRTHDAYS = "addressbook#contacts@group.v.calendar.google.com";
const CALENDARS = [
  { id: "alex@example.com", summary: "Alex Prive", accessRole: "owner" },
  { id: BIRTHDAYS, summary: "Verjaardagen", accessRole: "reader" },
  { id: "nl.dutch#holiday@group.v.calendar.google.com", summary: "Feestdagen", accessRole: "reader" },
];
const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

async function google(t: TestContext, only = "Alex Prive, Verjaardagen") {
  const database = new TestDatabase();
  t.after(() => database.sqlite.close());
  const keyBytes = new Uint8Array(32);
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["encrypt"]);
  const iv = new Uint8Array(12);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode("refresh"));
  database.sqlite.prepare("INSERT INTO google_tasks_connection (id, refresh_token) VALUES ('primary', ?)").run(Buffer.concat([iv, Buffer.from(encrypted)]).toString("base64url"));
  database.sqlite.prepare("INSERT INTO workspace_state (id, data) VALUES ('primary', ?)").run(JSON.stringify([createGoogleCalendarDatabase()]));
  const events: Record<string, Map<string, Record<string, unknown>>> = Object.fromEntries(CALENDARS.map((calendar) => [calendar.id, new Map()]));
  events[BIRTHDAYS].set("bday_sanne", { id: "bday_sanne", summary: "Verjaardag Sanne", recurringEventId: "bday_series", start: { date: inDays(3) }, end: { date: inDays(4) }, etag: "b1", updated: "2026-01-01T00:00:00Z" });
  events["nl.dutch#holiday@group.v.calendar.google.com"].set("koningsdag", { id: "koningsdag", summary: "Koningsdag", start: { date: inDays(5) }, end: { date: inDays(6) } });
  const requests: Array<{ method: string; path: string }> = [];
  let created = 0;
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const method = init.method || "GET";
    requests.push({ method, path: decodeURIComponent(url.pathname) });
    if (url.hostname === "oauth2.googleapis.com") return Response.json({ access_token: "token" });
    if (url.pathname.endsWith("/users/me/calendarList")) return Response.json({ items: CALENDARS });
    const match = decodeURIComponent(url.pathname).match(/\/calendars\/(.+?)\/events\/?(.*)$/)!;
    const calendar = events[match[1]];
    if (method === "GET" && !match[2]) return Response.json({ items: [...calendar.values()] });
    if (method === "POST") { const event = { ...JSON.parse(String(init.body)), id: `new-${++created}`, etag: "e1", updated: "2026-06-10T10:00:00Z" }; calendar.set(event.id, event); return Response.json(event); }
    if (method === "GET") return calendar.has(match[2]) ? Response.json(calendar.get(match[2])) : Response.json({ error: { message: "Missing" } }, { status: 404 });
    return Response.json({ error: { message: "Forbidden" } }, { status: 403 });
  });
  const env = { DB: database, GOOGLE_CLIENT_ID: "test", GOOGLE_CLIENT_SECRET: "test", GOOGLE_TOKEN_ENCRYPTION_KEY: Buffer.from(keyBytes).toString("base64url"), GOOGLE_CALENDAR_SYNC_ONLY: only };
  const workspace = () => JSON.parse(String(database.sqlite.prepare("SELECT data FROM workspace_state").get()!.data)) as Item[];
  const rows = () => (workspace()[0] as Database).rows;
  const sync = async (items: Item[] = workspace()) => {
    const revision = database.sqlite.prepare("SELECT revision FROM workspace_state").get()!.revision;
    const request = new Request("https://personal.test/api/google-calendar/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items, baseRevision: revision, protocolVersion: 2, capabilities: ["trash"] }) });
    const response = (await handleGoogleCalendarApi(request, env, new URL(request.url)))!;
    return { status: response.status, body: await response.json() };
  };
  const edit = (change: (database: Database) => void) => { const items = workspace(); change(items[0] as Database); return items; };
  return { events, requests, rows, sync, edit };
}

const writes = (requests: Array<{ method: string; path: string }>) => requests.filter((request) => request.method !== "GET" && request.path.includes(BIRTHDAYS));

test("the sync setting accepts several calendars and knows the birthday calendar by its id", () => {
  assert.deepEqual(syncedCalendars(CALENDARS, "Alex Prive, Verjaardagen").map((calendar) => calendar.summary), ["Alex Prive", "Verjaardagen"]);
  assert.deepEqual(syncedCalendars(CALENDARS, "Alex Prive").map((calendar) => calendar.summary), ["Alex Prive"]);
  assert.deepEqual(syncedCalendars(CALENDARS, "").map((calendar) => calendar.summary), ["Alex Prive"], "read-only calendars only when named");
  assert.deepEqual(syncedCalendars([{ ...CALENDARS[1], summary: "Contacten" }], "Birthdays").map((calendar) => calendar.id), [BIRTHDAYS]);
  assert.equal(isSyncedCalendar(CALENDARS[0], "Alex Werk; Alex Prive"), true);
});

test("birthdays are imported as read-only, without extra series requests", async (t) => {
  const g = await google(t);
  assert.equal((await g.sync()).status, 200);
  const birthday = g.rows().find((row) => row.title === "Verjaardag Sanne");
  assert.ok(birthday);
  assert.equal(birthday.values[CAL.readOnly], true);
  assert.equal(g.rows().some((row) => row.title === "Koningsdag"), false, "unnamed read-only calendars stay out");
  assert.equal(g.requests.filter((request) => request.path.includes(`${BIRTHDAYS}/events/`)).length, 0);
});

test("a birthday edited in the app is restored and never written to Google", async (t) => {
  const g = await google(t);
  await g.sync();
  const items = g.edit((database) => { database.rows = database.rows.map((row) => row.title === "Verjaardag Sanne" ? { ...row, title: "Feestje Sanne" } : row); });
  assert.equal((await g.sync(items)).status, 200);
  assert.equal(g.rows().find((row) => row.values[CAL.id] === "bday_sanne")?.title, "Verjaardag Sanne");
  assert.deepEqual(writes(g.requests), []);
});

test("a birthday removed in the app stays removed and Google keeps it", async (t) => {
  const g = await google(t);
  await g.sync();
  const items = g.edit((database) => { database.rows = database.rows.filter((row) => row.title !== "Verjaardag Sanne"); });
  assert.equal((await g.sync(items)).status, 200);
  assert.equal((await g.sync()).status, 200);
  assert.equal(g.rows().some((row) => row.title === "Verjaardag Sanne"), false);
  assert.equal(g.events[BIRTHDAYS].size, 1);
  assert.deepEqual(writes(g.requests), []);
});

test("a new appointment goes to the writable calendar, never to Birthdays", async (t) => {
  const g = await google(t);
  await g.sync();
  const items = g.edit((database) => { database.rows.push({ id: "local", title: "Etentje", blocks: [], values: { [CAL.start]: inDays(2), [CAL.end]: inDays(3), [CAL.allDay]: true } }); });
  assert.equal((await g.sync(items)).status, 200);
  assert.equal(g.events["alex@example.com"].size, 1);
  assert.deepEqual(writes(g.requests), []);
});
