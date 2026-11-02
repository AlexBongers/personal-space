import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { summarizeDay, upcomingEvents } from "../desktop/agenda.ts";
import { createBackgroundSync } from "../desktop/background-sync.ts";
import { writeLog } from "../desktop/logger.ts";
import { exportMarkdown } from "../desktop/markdown-export.ts";
import { importMarkdown, markdownToBlocks } from "../desktop/markdown-import.ts";
import { GOOGLE_CALENDAR_DATABASE_ID, GOOGLE_CALENDAR_PROPERTY_IDS, GOOGLE_TASKS_DATABASE_ID, GOOGLE_TASK_PROPERTY_IDS } from "../app/personal-space/model.ts";
import type { Database, Item, Page, Row } from "../app/personal-space/types.ts";

const tempDir = (name: string) => mkdtempSync(join(tmpdir(), `ps-${name}-`));
const database = (id: string, rows: Row[]): Database => ({ id, kind: "database", title: id, icon: "x", parentId: null, properties: [], rows, view: { mode: "table", filters: [], sorts: [] } as never });
const event = (id: string, title: string, start: string): Row => ({ id, title, blocks: [], values: { [GOOGLE_CALENDAR_PROPERTY_IDS.start]: start, [GOOGLE_CALENDAR_PROPERTY_IDS.end]: "", [GOOGLE_CALENDAR_PROPERTY_IDS.allDay]: false } });
const task = (id: string, title: string, due: string, status = "Open"): Row => ({ id, title, blocks: [], values: { [GOOGLE_TASK_PROPERTY_IDS.status]: status, [GOOGLE_TASK_PROPERTY_IDS.due]: due } });

// 2026-06-10 12:00 in Amsterdam (UTC+2).
const NOW = new Date("2026-06-10T10:00:00Z");
const items: Item[] = [
  database(GOOGLE_CALENDAR_DATABASE_ID, [event("e1", "Teamoverleg", "2026-06-10T12:05:00+02:00"), event("e2", "Tandarts", "2026-06-10T16:00:00+02:00"), event("e3", "Morgen", "2026-06-11T09:00:00+02:00")]),
  database(GOOGLE_TASKS_DATABASE_ID, [task("t1", "Boodschappen", "2026-06-10"), task("t2", "Te laat", "2026-06-08"), task("t3", "Later", "2026-06-20"), task("t4", "Klaar", "2026-06-10", "Done")]),
];

test("the day summary lists today's events and the due tasks", () => {
  const day = summarizeDay(items, NOW);
  assert.deepEqual(day.events.map((entry) => entry.label), ["12:05  Teamoverleg", "16:00  Tandarts"]);
  assert.deepEqual(day.tasks.sort(), ["Boodschappen", "Te laat"]);
  assert.equal(day.dueCount, 2);
});

test("a workspace without Google data gives an empty summary", () => {
  assert.deepEqual(summarizeDay([], NOW), { events: [], tasks: [], dueCount: 0 });
});

test("reminders fire once for events starting within the lead time", () => {
  const announced = new Set<string>();
  assert.deepEqual(upcomingEvents(items, NOW, 10, announced), [{ title: "Teamoverleg", time: "12:05" }]);
  assert.deepEqual(upcomingEvents(items, NOW, 10, announced), []);
  assert.deepEqual(upcomingEvents(items, new Date("2026-06-10T13:55:00Z"), 10, announced), [{ title: "Tandarts", time: "16:00" }]);
});

test("the log appends lines and rotates when it grows large", () => {
  const dir = tempDir("log");
  writeLog(dir, "eerste", new Date("2026-01-01T00:00:00Z"));
  assert.equal(readFileSync(join(dir, "app.log"), "utf8"), "2026-01-01T00:00:00.000Z eerste\n");
  writeFileSync(join(dir, "app.log"), "x".repeat(1_000_001));
  writeLog(dir, "tweede");
  assert.match(readFileSync(join(dir, "app.log"), "utf8"), /tweede/);
  assert.equal(readFileSync(join(dir, "app.log.1"), "utf8").length, 1_000_001);
});

test("Markdown becomes blocks", () => {
  const blocks = markdownToBlocks("---\nStatus: \"x\"\n---\n\n# Titel\n\n## Kop\n- a\n- [x] klaar\n- [ ] open\n1. een\n> wijs\n---\n```\ncode\nregel\n```\ntekst", "Titel");
  assert.deepEqual(blocks.map((block) => [block.type, block.text]), [
    ["heading2", "Kop"], ["bulleted", "a"], ["todo", "klaar"], ["todo", "open"], ["numbered", "een"], ["quote", "wijs"], ["divider", ""], ["code", "code\nregel"], ["paragraph", "tekst"],
  ]);
  assert.equal(blocks[2].checked, true);
  assert.equal(blocks[3].checked, false);
});

test("an empty Markdown file still gives one block", () => {
  assert.equal(markdownToBlocks("").length, 1);
});

test("a folder export imports back with the same page hierarchy", () => {
  const page = (id: string, title: string, parentId: string | null, text: string): Page => ({ id, kind: "page", title, icon: "x", parentId, blocks: [{ id: `b${id}`, type: "paragraph", text }] });
  const dir = tempDir("roundtrip");
  exportMarkdown([page("1", "Reizen", null, "Hallo"), page("2", "Japan", "1", "Tokyo")], dir);
  mkdirSync(join(dir, "Los", "Diep"), { recursive: true });
  writeFileSync(join(dir, "Los", "Diep", "Notitie.md"), "# Notitie\n\ninhoud");
  writeFileSync(join(dir, "genegeerd.txt"), "nee");
  const pages = importMarkdown(dir, "root");
  const byTitle = Object.fromEntries(pages.map((entry) => [entry.title, entry]));
  assert.deepEqual(Object.keys(byTitle).sort(), ["Diep", "Japan", "Los", "Notitie", "Reizen"]);
  assert.equal(byTitle.Reizen.parentId, "root");
  assert.equal(byTitle.Japan.parentId, byTitle.Reizen.id);
  assert.equal(byTitle.Japan.blocks[0].text, "Tokyo");
  assert.equal(byTitle.Notitie.parentId, byTitle.Diep.id);
  assert.equal(byTitle.Diep.parentId, byTitle.Los.id);
  assert.equal(new Set(pages.map((entry) => entry.id)).size, pages.length);
});

test("background sync reports failures instead of throwing", async () => {
  const messages: string[] = [];
  const sync = createBackgroundSync({ baseUrl: "http://localhost:3210", isWindowOpen: () => false, onParroUnread: () => {}, onError: (message) => messages.push(message), fetchImpl: (async () => { throw new Error("down"); }) as unknown as typeof fetch });
  await sync.run();
  assert.deepEqual(messages, ["Parro-sync mislukt: down", "Google-sync mislukt: down"]);
});
