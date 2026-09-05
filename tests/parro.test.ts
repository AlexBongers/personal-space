import assert from "node:assert/strict";
import test from "node:test";
import { handleParroApi, sanitizeParroPayload, type ParroDatabase, type ParroStatement } from "../worker/parro.ts";

const message = {
  id: "announcement:one",
  kind: "announcement",
  title: "School update",
  body: "A short update for parents.",
  sender: "School",
  roomName: "Group 4",
  publishedAt: "2026-09-05T08:00:00Z",
  unread: true,
  unreadCount: 1,
  externalUrl: "https://parro.com/announcement/one",
  attachmentCount: 2,
  attachmentNames: ["weekbrief.pdf", "foto.jpg"],
};

test("Parro payloads are bounded, normalized and limited to safe links", () => {
  const payload = sanitizeParroPayload({ replace: true, syncedAt: "not-a-date", messages: [{ ...message, title: "  A   title  ", externalUrl: "https://evil.test/message" }] }, "2026-09-05T09:00:00.000Z");
  assert.ok(payload);
  assert.equal(payload.replace, true);
  assert.equal(payload.syncedAt, "2026-09-05T09:00:00.000Z");
  assert.equal(payload.messages[0].title, "A title");
  assert.equal(payload.messages[0].externalUrl, "");
  assert.equal(payload.messages[0].attachmentCount, 2);
  assert.deepEqual(payload.messages[0].attachmentNames, ["weekbrief.pdf", "foto.jpg"]);
  assert.equal(sanitizeParroPayload({ messages: [{ ...message, kind: "unknown" }] }), null);
  assert.equal(sanitizeParroPayload({ messages: Array.from({ length: 201 }, () => message) }), null);
});

test("hosted Parro reads require the Site visitor identity", async () => {
  const database: ParroDatabase = {
    prepare: () => ({ bind() { return this; }, async all<T>() { return { results: [{ id: "announcement:one", kind: "announcement", title: "School update", body: "Read me", sender: "School", room_name: "Group 4", published_at: "2026-09-05T08:00:00.000Z", unread: 1, unread_count: 1, external_url: "", attachment_count: 2, attachment_names_json: '["weekbrief.pdf","foto.jpg"]', synced_at: "2026-09-05T09:00:00.000Z" }] as T[] }; }, async run() { return { meta: { changes: 0 } }; } }),
    batch: async () => [],
  };
  const env = { DB: database };
  const unauthorized = await handleParroApi(new Request("https://personal.test/api/parro/messages"), env);
  assert.equal(unauthorized?.status, 401);
  assert.equal((await unauthorized!.json()).state, "sign_in_required");
  const authorized = await handleParroApi(new Request("https://personal.test/api/parro/messages?limit=6", { headers: { "oai-authenticated-user-id": "owner" } }), env);
  assert.equal(authorized?.status, 200);
  assert.deepEqual((await authorized!.json()).messages[0], { id: "announcement:one", kind: "announcement", title: "School update", body: "Read me", sender: "School", roomName: "Group 4", publishedAt: "2026-09-05T08:00:00.000Z", unread: true, unreadCount: 1, externalUrl: "", attachmentCount: 2, attachmentNames: ["weekbrief.pdf", "foto.jpg"] });
});

test("Parro sync requires the bearer token and writes an atomic snapshot", async () => {
  const queries: string[] = [];
  const statements: ParroStatement[] = [];
  const database: ParroDatabase = {
    prepare: (query) => {
      queries.push(query);
      const statement: ParroStatement = {
        bind() { return statement; },
        async all<T>() { return { results: [] as T[] }; },
        async run() { return { meta: { changes: 1 } }; },
      };
      statements.push(statement);
      return statement;
    },
    batch: async (batch) => { statements.push(...batch); return []; },
  };
  const env = { DB: database, PARRO_SYNC_TOKEN: "sync-secret" };
  const endpoint = "https://personal.test/api/parro/sync";
  assert.equal((await handleParroApi(new Request(endpoint, { method: "POST" }), env))?.status, 401);
  const response = await handleParroApi(new Request(endpoint, {
    method: "POST",
    headers: { Authorization: "Bearer sync-secret", "Content-Type": "application/json" },
    body: JSON.stringify({ replace: true, syncedAt: "2026-09-05T09:00:00Z", messages: [message] }),
  }), env);
  assert.equal(response?.status, 200);
  assert.deepEqual(await response!.json(), { ok: true, count: 1, syncedAt: "2026-09-05T09:00:00.000Z" });
  assert.equal(queries.filter((query) => query.includes("INSERT INTO parro_messages")).length, 1);
  assert.ok(queries.some((query) => query.includes("attachment_names_json")));
  assert.equal(queries.filter((query) => query.includes("DELETE FROM parro_messages")).length, 1);
});
