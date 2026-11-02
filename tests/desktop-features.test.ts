import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createBackgroundSync } from "../desktop/background-sync.ts";
import { backupDatabase } from "../desktop/backup.ts";
import { DEFAULT_PORT, loadUserConfig } from "../desktop/config.ts";
import { D1Database } from "../desktop/d1-sqlite.ts";
import { blocksToMarkdown, exportMarkdown } from "../desktop/markdown-export.ts";
import { migrate } from "../desktop/migrate.ts";
import { addQuickNote } from "../desktop/quick-note.ts";
import { restoreBackup } from "../desktop/restore.ts";
import { loadWorkspace } from "../worker/workspace-store.ts";
import type { Block, Item } from "../app/personal-space/types.ts";

const migrated = () => {
  const database = new D1Database(":memory:");
  migrate(database, "drizzle");
  return database;
};
const tempDir = (name: string) => mkdtempSync(join(tmpdir(), `ps-${name}-`));

test("a quick note creates the notes page and appends to it afterwards", async () => {
  const database = migrated();
  const before = (await loadWorkspace(database as never)).items.length;
  const pageId = await addQuickNote(database as never, "eerste\ntweede", new Date("2026-03-01T10:30:00Z"));
  assert.equal(await addQuickNote(database as never, "derde", new Date("2026-03-01T11:00:00Z")), pageId);
  const { items } = await loadWorkspace(database as never);
  assert.equal(items.length, before + 1);
  const page = items.find((item) => item.title === "Snelle notities");
  assert.equal(page?.kind, "page");
  assert.equal(page?.id, pageId);
  const texts = page?.kind === "page" ? page.blocks.map((block) => block.text) : [];
  assert.deepEqual(texts, ["01-03-2026, 11:30 eerste", "tweede", "01-03-2026, 12:00 derde"]);
});

test("an empty quick note is ignored", async () => {
  assert.equal(await addQuickNote(migrated() as never, "  \n "), null);
});

test("blocks convert to Markdown", () => {
  const block = (type: Block["type"], text: string, checked = false): Block => ({ id: text, type, text, checked });
  const markdown = blocksToMarkdown([block("heading1", "Titel"), block("numbered", "a"), block("numbered", "b"), block("todo", "klaar", true), block("todo", "open"), block("quote", "wijs"), block("divider", ""), block("code", "x = 1")]);
  assert.equal(markdown, "# Titel\n\n1. a\n\n2. b\n\n- [x] klaar\n\n- [ ] open\n\n> wijs\n\n---\n\n```\nx = 1\n```");
});

test("the Markdown export nests pages, writes database rows and skips the trash", async () => {
  const items: Item[] = [
    { id: "p1", kind: "page", title: "Reizen", icon: "x", parentId: null, blocks: [{ id: "b", type: "paragraph", text: "Hallo" }] },
    { id: "p2", kind: "page", title: "Japan", icon: "x", parentId: "p1", blocks: [] },
    { id: "p3", kind: "page", title: "Weg", icon: "x", parentId: null, blocks: [], trash: { deletedAt: "now", batchId: "1", rootId: "p3" } },
    { id: "d1", kind: "database", title: "Boeken", icon: "x", parentId: null,
      properties: [{ id: "s", name: "Status", type: "select", options: [{ id: "o1", label: "Gelezen", color: "green" }] }],
      rows: [{ id: "r1", title: "Dune", values: { s: "o1" }, blocks: [] }, { id: "r2", title: "Weg", values: {}, blocks: [], trash: { deletedAt: "now", batchId: "1", rootId: "r2" } }],
      view: { mode: "table", filters: [], sorts: [] } as never },
  ];
  const dir = tempDir("export");
  assert.equal(exportMarkdown(items, dir), 3);
  assert.match(readFileSync(join(dir, "Reizen.md"), "utf8"), /# Reizen\n\nHallo/);
  assert.ok(existsSync(join(dir, "Reizen", "Japan.md")));
  assert.ok(!existsSync(join(dir, "Weg.md")));
  assert.match(readFileSync(join(dir, "Boeken", "Dune.md"), "utf8"), /Status: "Gelezen"/);
  assert.ok(!existsSync(join(dir, "Boeken", "Weg.md")));
});

test("duplicate titles get unique file names", () => {
  const page = (id: string): Item => ({ id, kind: "page", title: "Notitie", icon: "x", parentId: null, blocks: [] });
  const dir = tempDir("dupes");
  exportMarkdown([page("a"), page("b")], dir);
  assert.deepEqual(readdirSync(dir).sort(), ["Notitie 2.md", "Notitie.md"]);
});

test("restoring a backup replaces the database and keeps the old one", async () => {
  const dir = tempDir("restore");
  const live = new D1Database(join(dir, "personal-space.sqlite"));
  migrate(live, "drizzle");
  await addQuickNote(live as never, "oud");
  backupDatabase(live, dir, new Date("2026-02-01T00:00:00Z"));
  await addQuickNote(live as never, "nieuw");
  live.close();
  restoreBackup(dir, join(dir, "backups", "personal-space-2026-02-01.sqlite"), new Date("2026-02-02T00:00:00Z"));
  const restored = new D1Database(join(dir, "personal-space.sqlite"));
  const page = (await loadWorkspace(restored as never)).items.find((item) => item.title === "Snelle notities");
  assert.equal(page?.kind === "page" ? page.blocks.length : 0, 1);
  assert.ok(readdirSync(join(dir, "backups")).some((file) => file.startsWith("before-restore-")));
});

test("the port defaults to 3210 and can be set in config.json", () => {
  const dir = tempDir("port");
  assert.equal(loadUserConfig(dir).port, DEFAULT_PORT);
  writeFileSync(join(dir, "config.json"), JSON.stringify({ googleClientId: "", googleClientSecret: "", googleCalendarSyncOnly: "", port: 4000 }));
  assert.equal(loadUserConfig(dir).port, 4000);
});

type Call = { path: string; method: string; body?: string; origin?: string };
const fakeApp = (responses: Record<string, unknown>) => {
  const calls: Call[] = [];
  const fetchImpl = (async (url: string, init: RequestInit = {}) => {
    const path = url.replace("http://localhost:3210", "");
    calls.push({ path, method: init.method ?? "GET", body: init.body as string | undefined, origin: (init.headers as Record<string, string>).Origin });
    const body = responses[path.split("?")[0]];
    return body === undefined ? new Response("{}", { status: 404 }) : new Response(JSON.stringify(body));
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
};

test("background sync refreshes Parro, reports new unread messages and sends the origin", async () => {
  const { calls, fetchImpl } = fakeApp({ "/api/parro/messages": { connectionState: "connected", unread: 2 }, "/api/parro/refresh": {} });
  const reports: [number, boolean][] = [];
  const sync = createBackgroundSync({ baseUrl: "http://localhost:3210", isWindowOpen: () => true, onParroUnread: (unread, increased) => reports.push([unread, increased]), fetchImpl });
  await sync.run();
  assert.deepEqual(reports, [[2, false]]);
  assert.ok(calls.some((call) => call.path === "/api/parro/refresh" && call.method === "POST" && call.origin === "http://localhost:3210"));
});

test("Google sync is skipped while a window is open and runs when it is closed", async () => {
  const responses = {
    "/api/parro/messages": { connectionState: "disconnected" },
    "/api/google-tasks/status": { connected: true },
    "/api/google-calendar/status": { connected: false },
    "/api/workspace": { items: [], revision: 7 },
    "/api/google-tasks/sync": {},
  };
  const open = fakeApp(responses);
  await createBackgroundSync({ baseUrl: "http://localhost:3210", isWindowOpen: () => true, onParroUnread: () => {}, fetchImpl: open.fetchImpl }).run();
  assert.ok(!open.calls.some((call) => call.path.endsWith("/sync")));

  const closed = fakeApp(responses);
  await createBackgroundSync({ baseUrl: "http://localhost:3210", isWindowOpen: () => false, onParroUnread: () => {}, fetchImpl: closed.fetchImpl }).run();
  const sent = closed.calls.find((call) => call.path === "/api/google-tasks/sync");
  assert.equal(JSON.parse(sent?.body ?? "{}").baseRevision, 7);
  assert.ok(!closed.calls.some((call) => call.path === "/api/google-calendar/sync"));
});

test("a failing server does not stop background sync", async () => {
  const sync = createBackgroundSync({ baseUrl: "http://localhost:3210", isWindowOpen: () => false, onParroUnread: () => {}, fetchImpl: (async () => { throw new Error("down"); }) as unknown as typeof fetch });
  await sync.run();
  await sync.run();
});
