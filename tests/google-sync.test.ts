import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { createGoogleCalendarDatabase, createGoogleTasksDatabase, GOOGLE_CALENDAR_PROPERTY_IDS } from "../app/personal-space/model.ts";
import { handleGoogleTasksApi, type GoogleTasksDatabase, type GoogleTasksStatement } from "../worker/google-tasks.ts";
import { googleTaskToRow, googleRowFingerprint } from "../worker/google-tasks-sync.ts";
import { googleCalendarToRow, googleCalendarPayload, handleGoogleCalendarApi } from "../worker/google-calendar.ts";
import { withGoogleSyncLock } from "../worker/google-sync-guard.ts";
import type { Item } from "../app/personal-space/types.ts";

class TestDatabase implements GoogleTasksDatabase {
  sqlite = new DatabaseSync(":memory:");
  failAcknowledgement = false;
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
    try {
      const results = [];
      for (const statement of statements) {
        results.push(await statement.run());
        if (this.failAcknowledgement) { this.failAcknowledgement = false; throw new Error("Simulated acknowledgement failure"); }
      }
      this.sqlite.exec("COMMIT");
      return results;
    } catch (error) { this.sqlite.exec("ROLLBACK"); throw error; }
  }
}

async function fixture(t: TestContext, service: "tasks" | "calendar") {
  const database = new TestDatabase();
  t.after(() => database.sqlite.close());
  const keyBytes = new Uint8Array(32);
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["encrypt"]);
  const iv = new Uint8Array(12);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode("test-refresh"));
  database.sqlite.prepare("INSERT INTO google_tasks_connection (id, refresh_token) VALUES ('primary', ?)").run(Buffer.concat([iv, Buffer.from(encrypted)]).toString("base64url"));
  const integration = service === "tasks" ? createGoogleTasksDatabase() : createGoogleCalendarDatabase();
  integration.rows = [{ id: "local-new", title: "Synthetic new item", values: service === "tasks" ? { "google-status": "Open" } : { [GOOGLE_CALENDAR_PROPERTY_IDS.start]: "2026-09-05", [GOOGLE_CALENDAR_PROPERTY_IDS.allDay]: true }, blocks: [] }];
  database.sqlite.prepare("INSERT INTO workspace_state (id, data) VALUES ('primary', ?)").run(JSON.stringify([integration]));
  const remote = new Map<string, Record<string, unknown>>();
  const requests: Array<{ method: string; path: string }> = [];
  let creates = 0;
  const behavior = { conflictOnCreate: false, loseResponse: false, rejectCreate: false, hideFromList: false, onCreate: null as null | (() => Promise<void>) };
  const calendar = { id: "container-1", summary: "Test calendar", accessRole: "owner" };
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const method = init.method || "GET";
    requests.push({ method, path: url.pathname });
    if (url.hostname === "oauth2.googleapis.com") return Response.json({ access_token: "test-access" });
    if (url.pathname.endsWith("/users/@me/lists")) return Response.json({ items: [{ id: "container-1", title: "Test list" }] });
    if (url.pathname.endsWith("/calendarList")) return Response.json({ items: [calendar] });
    if (method === "POST") {
      if (behavior.rejectCreate) return Response.json({ error: { message: "Invalid request" } }, { status: 400 });
      creates++;
      const result = { ...JSON.parse(String(init.body)), id: `remote-${creates}`, etag: "etag-1", updated: "2026-09-04T12:00:00Z" };
      remote.set(result.id, result);
      if (behavior.conflictOnCreate) { database.sqlite.exec("UPDATE workspace_state SET revision = revision + 1"); behavior.conflictOnCreate = false; }
      await behavior.onCreate?.();
      if (behavior.loseResponse) throw new TypeError("Simulated lost response");
      return Response.json(result);
    }
    if (url.pathname.endsWith("/tasks") || url.pathname.endsWith("/events")) return Response.json({ items: behavior.hideFromList ? [] : [...remote.values()].filter((value) => !value.hiddenFromList) });
    const id = decodeURIComponent(url.pathname.split("/").at(-1)!);
    if (method === "DELETE") { remote.delete(id); return new Response(null, { status: 204 }); }
    const existing = remote.get(id);
    if (!existing) return Response.json({ error: { message: "Missing" } }, { status: 404 });
    if (method === "PUT" || method === "PATCH") {
      const updated = { ...existing, ...JSON.parse(String(init.body)), etag: "etag-2" };
      remote.set(id, updated);
      return Response.json(updated);
    }
    return Response.json(existing);
  });
  const env = { DB: database, GOOGLE_CLIENT_ID: "test", GOOGLE_CLIENT_SECRET: "test", GOOGLE_TOKEN_ENCRYPTION_KEY: Buffer.from(keyBytes).toString("base64url") };
  const run = async (items: Item[] = [integration], revision?: number, writer = true) => {
    const current = database.sqlite.prepare("SELECT revision FROM workspace_state").get()!;
    const request = new Request(`https://personal.test/api/google-${service}/sync`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items, baseRevision: revision ?? current.revision, ...(writer ? { protocolVersion: 2, capabilities: ["trash"] } : {}) }) });
    const handler = service === "tasks" ? handleGoogleTasksApi : handleGoogleCalendarApi;
    const response = (await handler(request, env, new URL(request.url)))!;
    return { status: response.status, body: await response.json() };
  };
  const installMapping = (id = "existing", locallyDeleted = false) => {
    const value = service === "tasks" ? { id, title: "Mapped item", status: "needsAction", etag: "old", updated: "old" } : { id, summary: "Mapped item", start: { date: "2026-09-05" }, end: { date: "2026-09-06" }, etag: "old", updated: "old" };
    remote.set(id, value);
    const row = service === "tasks" ? googleTaskToRow(value, "Test list") : googleCalendarToRow(value, calendar);
    const fingerprint = service === "tasks" ? googleRowFingerprint(row) : JSON.stringify(googleCalendarPayload(row));
    const columns = service === "tasks" ? "task_list_id, remote_task_id" : "calendar_id, remote_event_id";
    database.sqlite.prepare(`INSERT INTO google_${service}_mapping (local_row_id, ${columns}, remote_etag, remote_updated, local_fingerprint) VALUES (?, 'container-1', ?, 'old', 'old', ?)`).run(row.id, id, fingerprint);
    integration.rows = locallyDeleted ? [] : [row];
    database.sqlite.prepare("UPDATE workspace_state SET data = ?").run(JSON.stringify([integration]));
    return row;
  };
  return { database, integration, remote, requests, behavior, run, installMapping, creates: () => creates };
}

for (const service of ["tasks", "calendar"] as const) {
  test(`${service}: acknowledged creation survives a workspace conflict without duplication`, async (t) => {
    const f = await fixture(t, service);
    f.behavior.conflictOnCreate = true;
    assert.equal((await f.run()).status, 409);
    const retried = await f.run();
    assert.equal(retried.status, 200);
    assert.equal(f.creates(), 1);
    assert.equal(retried.body.workspace.items[0].rows.length, 1);
    assert.equal(retried.body.workspace.items[0].rows[0].id, "local-new");
    assert.equal(f.database.sqlite.prepare("SELECT count(*) AS count FROM google_sync_creates").get()?.count, 0);
  });

  test(`${service}: a lost Google response is matched back without repeating the POST`, async (t) => {
    const f = await fixture(t, service);
    f.behavior.loseResponse = true;
    assert.equal((await f.run()).body.code, "sync_uncertain");
    const recovered = await f.run();
    assert.equal(recovered.status, 200);
    assert.equal(recovered.body.workspace.items[0].rows.length, 1);
    assert.equal(f.creates(), 1);
  });

  test(`${service}: an unmatched lost response pauses safely and never repeats the POST`, async (t) => {
    const f = await fixture(t, service);
    f.behavior.loseResponse = true;
    assert.equal((await f.run()).body.code, "sync_uncertain");
    f.behavior.hideFromList = true;
    assert.equal((await f.run()).body.code, "sync_uncertain");
    assert.equal(f.creates(), 1);
  });

  test(`${service}: recovery never adopts an identical item seen before the POST`, async (t) => {
    const f = await fixture(t, service);
    const existing = service === "tasks"
      ? { id: "pre-existing", title: "Synthetic new item", status: "needsAction" }
      : { id: "pre-existing", summary: "Synthetic new item", start: { date: "2026-09-05" }, end: { date: "2026-09-06" } };
    f.remote.set("pre-existing", existing);
    f.behavior.loseResponse = true;
    assert.equal((await f.run()).body.code, "sync_uncertain");
    const recovered = await f.run();
    assert.equal(recovered.status, 200);
    const idColumn = service === "tasks" ? "remote_task_id" : "remote_event_id";
    const mapping = f.database.sqlite.prepare(`SELECT ${idColumn} AS id FROM google_${service}_mapping WHERE local_row_id = 'local-new'`).get();
    assert.equal(mapping?.id, "remote-1");
    assert.equal(f.creates(), 1);
  });

  test(`${service}: competing sync requests cannot both create the same item`, async (t) => {
    const f = await fixture(t, service);
    const started = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    f.behavior.onCreate = async () => { started.resolve(); await release.promise; };
    const first = f.run();
    await started.promise;
    const second = await f.run();
    assert.equal(second.body.code, "sync_busy");
    release.resolve();
    assert.equal((await first).status, 200);
    assert.equal(f.creates(), 1);
  });

  test(`${service}: local deletion is not reimported from Google`, async (t) => {
    const f = await fixture(t, service);
    f.installMapping("existing", true);
    const result = await f.run();
    assert.equal(result.status, 200);
    assert.equal(result.body.workspace.items[0].rows.length, 0);
    assert.equal(f.remote.size, 0);
    assert.equal(f.requests.filter((request) => request.method === "DELETE").length, 1);
    assert.equal((await f.run(result.body.workspace.items)).status, 200);
    assert.equal(f.creates(), 0);
  });

  test(`${service}: explicit rejected creates can be corrected without a stuck receipt`, async (t) => {
    const f = await fixture(t, service);
    f.behavior.rejectCreate = true;
    assert.equal((await f.run()).status, 400);
    f.behavior.rejectCreate = false;
    assert.equal((await f.run()).status, 200);
    assert.equal(f.creates(), 1);
  });

  test(`${service}: a lost mapping acknowledgement is recovered without another creation`, async (t) => {
    const f = await fixture(t, service);
    t.mock.method(console, "error", () => {});
    f.database.failAcknowledgement = true;
    assert.equal((await f.run()).status, 500);
    assert.equal((await f.run()).status, 200);
    assert.equal(f.creates(), 1);
  });

  test(`${service}: receipt restores a lost mapping without duplicating an imported row`, async (t) => {
    const f = await fixture(t, service);
    f.behavior.conflictOnCreate = true;
    assert.equal((await f.run()).status, 409);
    f.database.sqlite.exec(`DELETE FROM google_${service}_mapping`);
    const result = await f.run();
    assert.equal(result.status, 200);
    assert.equal(result.body.workspace.items[0].rows.length, 1);
    assert.equal(f.creates(), 1);
  });

  test(`${service}: trash preserves the local copy and performs no Google write`, async (t) => {
    const f = await fixture(t, service);
    const row = f.installMapping("existing");
    row.trash = { deletedAt: "2026-09-05T12:00:00.000Z", batchId: "batch-1", rootId: row.id };
    const before = JSON.stringify(row);
    const remoteBefore = JSON.stringify(f.remote.get("existing"));
    const result = await f.run();
    assert.equal(result.status, 200);
    assert.equal(JSON.stringify(result.body.workspace.items[0].rows[0]), before);
    assert.equal(JSON.stringify(f.remote.get("existing")), remoteBefore);
    assert.equal(f.requests.filter((request) => ["POST", "PATCH", "PUT", "DELETE"].includes(request.method) && !request.path.endsWith("/token")).length, 0);
  });

  test(`${service}: a legacy writer is rejected while trash exists`, async (t) => {
    const f = await fixture(t, service);
    const row = f.installMapping("existing");
    row.trash = { deletedAt: "2026-09-05T12:00:00.000Z", batchId: "batch-1", rootId: row.id };
    const result = await f.run(undefined, undefined, false);
    assert.equal(result.status, 409);
    assert.equal(result.body.code, "workspace_protocol_mismatch");
    assert.equal(f.requests.length, 0);
  });

  test(`${service}: purged integration database uses retained mappings for one explicit remote delete`, async (t) => {
    const f = await fixture(t, service);
    f.installMapping("existing");
    const result = await f.run([]);
    assert.equal(result.status, 200);
    assert.equal(result.body.workspace.items.length, 0);
    assert.equal(f.remote.size, 0);
    assert.equal(f.requests.filter((request) => request.method === "DELETE").length, 1);
    const retried = await f.run(result.body.workspace.items, result.body.workspace.revision);
    assert.equal(retried.status, 200);
    assert.equal(f.requests.filter((request) => request.method === "DELETE").length, 1);
  });

  test(`${service}: remote deletion after restore is surfaced as a conflict without silent recreation`, async (t) => {
    const f = await fixture(t, service);
    const row = f.installMapping("existing");
    row.trash = { deletedAt: "2026-09-05T12:00:00.000Z", batchId: "batch-1", rootId: row.id };
    const trashed = await f.run();
    f.remote.clear();
    const restoredItems = trashed.body.workspace.items.map((item: Item) => item.kind === "database"
      ? { ...item, rows: item.rows.map((entry) => { const { trash: _trash, ...rest } = entry; void _trash; return rest; }) }
      : item);
    const result = await f.run(restoredItems, trashed.body.workspace.revision);
    assert.equal(result.status, 200);
    assert.equal(result.body.sync.conflicts, 1);
    assert.equal(result.body.workspace.items[0].rows.length, 1);
    assert.equal(f.creates(), 0);
    assert.equal(f.requests.filter((request) => request.method === "DELETE").length, 0);
  });
}

test("calendar: an edited event outside the list window is updated, never recreated", async (t) => {
  const f = await fixture(t, "calendar");
  const row = f.installMapping();
  row.title = "Edited old event";
  f.behavior.hideFromList = true;
  const result = await f.run();
  assert.equal(result.status, 200);
  assert.equal(f.creates(), 0);
  assert.equal(f.remote.get("existing")?.summary, "Edited old event");
  assert.equal(result.body.workspace.items[0].rows.length, 1);
});

test("calendar: recurring instances inherit the recurrence rule from their series", async (t) => {
  const f = await fixture(t, "calendar");
  f.integration.rows = [];
  f.remote.set("instance-1", {
    id: "instance-1",
    recurringEventId: "series-1",
    summary: "Weekly planning",
    start: { date: "2026-09-07" },
    end: { date: "2026-09-08" },
    etag: "instance-etag",
    updated: "2026-09-04T12:00:00Z",
  });
  f.remote.set("series-1", {
    id: "series-1",
    recurrence: ["RRULE:FREQ=WEEKLY;BYDAY=MO"],
    attendees: [{ email: "laurademooij@gmail.com" }, { email: "guest@example.com" }],
    hiddenFromList: true,
  });
  const staleEvent = f.remote.get("instance-1")! as unknown as Parameters<typeof googleCalendarToRow>[0];
  const staleRow = googleCalendarToRow(staleEvent, { id: "container-1", summary: "Test calendar", accessRole: "owner" });
  f.integration.rows = [staleRow];
  const staleFingerprint = JSON.stringify(googleCalendarPayload(staleRow));
  f.database.sqlite.prepare(`INSERT INTO google_calendar_mapping (local_row_id, calendar_id, remote_event_id, remote_etag, remote_updated, local_fingerprint) VALUES (?, 'container-1', 'instance-1', 'instance-etag', '2026-09-04T12:00:00Z', ?)`).run(staleRow.id, staleFingerprint);

  const result = await f.run();
  assert.equal(result.status, 200);
  const row = result.body.workspace.items[0].rows[0];
  assert.equal(row.values[GOOGLE_CALENDAR_PROPERTY_IDS.recurrence], "RRULE:FREQ=WEEKLY;BYDAY=MO");
  assert.equal(row.values[GOOGLE_CALENDAR_PROPERTY_IDS.attendees], "laurademooij@gmail.com, guest@example.com");
  assert.ok(f.requests.some((request) => request.method === "GET" && request.path.endsWith("/events/series-1")));
});

test("an expired sync lease cannot resume writing after another sync owns the lock", async () => {
  const database = new TestDatabase();
  try {
    await withGoogleSyncLock(database, async (oldGuard) => {
      database.sqlite.exec("UPDATE google_sync_lease SET expires_at = 0");
      await withGoogleSyncLock(database, async (newGuard) => {
        await assert.rejects(oldGuard.check(), /Er loopt al/);
        await newGuard.check();
      });
    });
  } finally { database.sqlite.close(); }
});
