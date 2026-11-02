import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { createGoogleTasksDatabase, GOOGLE_TASK_PROPERTY_IDS as TASK } from "../app/personal-space/model.ts";
import type { Database, Item } from "../app/personal-space/types.ts";
import { handleGoogleTasksApi, type GoogleTasksDatabase, type GoogleTasksStatement } from "../worker/google-tasks.ts";

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
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      this.sqlite.exec("COMMIT");
      return results;
    } catch (error) { this.sqlite.exec("ROLLBACK"); throw error; }
  }
}

type RemoteTask = { id: string; title: string; status: string; parent?: string; etag: string; updated: string };

/** A fake Google Tasks with two lists, "Werk" and "Privé". */
async function twoLists(t: TestContext) {
  const database = new TestDatabase();
  t.after(() => database.sqlite.close());
  const keyBytes = new Uint8Array(32);
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["encrypt"]);
  const iv = new Uint8Array(12);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode("refresh"));
  database.sqlite.prepare("INSERT INTO google_tasks_connection (id, refresh_token) VALUES ('primary', ?)").run(Buffer.concat([iv, Buffer.from(encrypted)]).toString("base64url"));
  database.sqlite.prepare("INSERT INTO workspace_state (id, data) VALUES ('primary', ?)").run(JSON.stringify([createGoogleTasksDatabase()]));

  const lists: Record<string, Map<string, RemoteTask>> = { work: new Map(), home: new Map() };
  const titles: Record<string, string> = { work: "Werk", home: "Privé" };
  let created = 0;
  const failures = { delete: 0 };
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const method = init.method || "GET";
    if (url.hostname === "oauth2.googleapis.com") return Response.json({ access_token: "token" });
    if (url.pathname.endsWith("/users/@me/lists") && method === "POST") {
      const id = `list-${Object.keys(lists).length + 1}`;
      lists[id] = new Map();
      titles[id] = JSON.parse(String(init.body)).title;
      return Response.json({ id, title: titles[id] });
    }
    if (url.pathname.endsWith("/users/@me/lists")) return Response.json({ items: Object.keys(lists).map((id) => ({ id, title: titles[id] })) });
    const match = url.pathname.match(/\/lists\/([^/]+)\/tasks\/?([^/]*)/)!;
    const list = lists[decodeURIComponent(match[1])];
    const id = decodeURIComponent(match[2]);
    if (method === "GET" && !id) return Response.json({ items: [...list.values()] });
    if (method === "POST") {
      const task = { ...JSON.parse(String(init.body)), id: `new-${++created}`, etag: "e1", updated: "2026-06-10T10:00:00Z" };
      list.set(task.id, task);
      return Response.json(task);
    }
    if (method === "DELETE") {
      if (failures.delete > 0) { failures.delete--; return Response.json({ error: { message: "Backend error" } }, { status: 500 }); }
      list.delete(id);
      return new Response(null, { status: 204 });
    }
    const existing = list.get(id);
    if (!existing) return Response.json({ error: { message: "Missing" } }, { status: 404 });
    const updated = { ...existing, ...JSON.parse(String(init.body)), etag: "e2" };
    list.set(id, updated);
    return Response.json(updated);
  });
  const env = { DB: database, GOOGLE_CLIENT_ID: "test", GOOGLE_CLIENT_SECRET: "test", GOOGLE_TOKEN_ENCRYPTION_KEY: Buffer.from(keyBytes).toString("base64url") };

  const workspace = () => JSON.parse(String(database.sqlite.prepare("SELECT data FROM workspace_state").get()!.data)) as Item[];
  const tasks = () => (workspace()[0] as Database).rows;
  const sync = async (items: Item[] = workspace()) => {
    const revision = database.sqlite.prepare("SELECT revision FROM workspace_state").get()!.revision;
    const request = new Request("https://personal.test/api/google-tasks/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items, baseRevision: revision, protocolVersion: 2, capabilities: ["trash"] }) });
    const response = (await handleGoogleTasksApi(request, env, new URL(request.url)))!;
    return { status: response.status, body: await response.json() };
  };
  /** The workspace with one task given another list, as a drag does. */
  const withList = (title: string, list: string) => {
    const items = workspace();
    const database = items[0] as Database;
    database.rows = database.rows.map((row) => row.title === title ? { ...row, values: { ...row.values, [TASK.list]: list } } : row);
    return items;
  };
  /** A new task in the workspace, as the editor or quick add makes one. */
  const withNewTask = (title: string, list: string) => {
    const items = workspace();
    (items[0] as Database).rows.push({ id: `local-${title}`, title, blocks: [], values: { [TASK.status]: "Open", [TASK.list]: list } });
    return items;
  };
  return { lists, titles, tasks, sync, withList, withNewTask, failures, creates: () => created };
}

test("a task dragged to another list moves in Google and stays one task", async (t) => {
  const g = await twoLists(t);
  g.lists.work.set("w1", { id: "w1", title: "Rapport", status: "needsAction", etag: "e0", updated: "2026-06-01T10:00:00Z" });
  assert.equal((await g.sync()).status, 200);
  assert.equal(g.tasks()[0].values[TASK.list], "Werk");

  const moved = await g.sync(g.withList("Rapport", "Privé"));
  assert.equal(moved.status, 200);
  assert.equal(g.lists.work.size, 0);
  assert.deepEqual([...g.lists.home.values()].map((task) => task.title), ["Rapport"]);
  assert.equal(g.tasks().length, 1);
  assert.equal(g.tasks()[0].values[TASK.list], "Privé");
  assert.equal(g.tasks()[0].values[TASK.id], [...g.lists.home.keys()][0]);

  const again = await g.sync();
  assert.equal(again.status, 200);
  assert.equal(g.creates(), 1);
  assert.equal(g.lists.home.size, 1);
  assert.equal(g.tasks().length, 1);
});

test("a task with subtasks stays in its list", async (t) => {
  const g = await twoLists(t);
  g.lists.work.set("p", { id: "p", title: "Verhuizen", status: "needsAction", etag: "e0", updated: "2026-06-01T10:00:00Z" });
  g.lists.work.set("c", { id: "c", title: "Dozen", status: "needsAction", parent: "p", etag: "e0", updated: "2026-06-01T10:00:00Z" });
  await g.sync();
  assert.equal((await g.sync(g.withList("Verhuizen", "Privé"))).status, 200);
  assert.equal(g.lists.work.size, 2);
  assert.equal(g.lists.home.size, 0);
  assert.equal(g.tasks().find((row) => row.title === "Verhuizen")?.values[TASK.list], "Werk");
});

test("an interrupted move leaves no duplicate after the next sync", async (t) => {
  const g = await twoLists(t);
  g.lists.work.set("w1", { id: "w1", title: "Rapport", status: "needsAction", etag: "e0", updated: "2026-06-01T10:00:00Z" });
  await g.sync();
  g.failures.delete = 1;
  assert.notEqual((await g.sync(g.withList("Rapport", "Privé"))).status, 200);
  // The copy exists in the new list and the original was left behind.
  assert.equal(g.lists.home.size, 1);
  assert.equal(g.lists.work.size, 1);

  assert.equal((await g.sync(g.withList("Rapport", "Privé"))).status, 200);
  assert.equal(g.lists.work.size, 0);
  assert.equal(g.lists.home.size, 1);
  assert.equal(g.creates(), 1);
  assert.deepEqual(g.tasks().map((row) => [row.title, row.values[TASK.list]]), [["Rapport", "Privé"]]);
});

test("a new list chosen in the app is created in Google with its task", async (t) => {
  const g = await twoLists(t);
  assert.equal((await g.sync(g.withNewTask("Schilderen", "Hobby"))).status, 200);
  const hobby = Object.keys(g.titles).find((id) => g.titles[id] === "Hobby");
  assert.ok(hobby);
  assert.deepEqual([...g.lists[hobby].values()].map((task) => task.title), ["Schilderen"]);
  assert.equal((await g.sync()).status, 200);
  assert.equal(Object.values(g.titles).filter((title) => title === "Hobby").length, 1);
  assert.equal(g.tasks()[0].values[TASK.list], "Hobby");
});

test("a task can be dragged to a list that does not exist in Google yet", async (t) => {
  const g = await twoLists(t);
  g.lists.work.set("w1", { id: "w1", title: "Rapport", status: "needsAction", etag: "e0", updated: "2026-06-01T10:00:00Z" });
  await g.sync();
  assert.equal((await g.sync(g.withList("Rapport", "Archief"))).status, 200);
  const archive = Object.keys(g.titles).find((id) => g.titles[id] === "Archief")!;
  assert.equal(g.lists.work.size, 0);
  assert.equal(g.lists[archive].size, 1);
});
