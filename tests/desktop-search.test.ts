import assert from "node:assert/strict";
import test from "node:test";
import { parseDeepLink } from "../desktop/deep-link.ts";
import { parseReminder } from "../desktop/natural-time.ts";
import { searchWorkspace } from "../desktop/search.ts";
import type { Item } from "../app/personal-space/types.ts";

const items: Item[] = [
  { id: "trip", kind: "page", title: "Reis naar Japan", icon: "x", parentId: null, blocks: [{ id: "1", type: "paragraph", text: "Tokyo in april, daarna naar Kyoto met de trein." }] },
  { id: "notes", kind: "page", title: "Notities", icon: "x", parentId: "trip", blocks: [{ id: "2", type: "paragraph", text: "Japan Rail Pass kopen voor vertrek." }] },
  { id: "old", kind: "page", title: "Japan oud", icon: "x", parentId: null, blocks: [], trash: { deletedAt: "now", batchId: "b", rootId: "old" } },
  { id: "books", kind: "database", title: "Boeken", icon: "x", parentId: null, properties: [], view: {} as never,
    rows: [{ id: "r1", title: "Kafka op het strand", values: { a: "Murakami, Japan" }, blocks: [] }] },
];

test("search finds titles, page content and database rows, titles first", () => {
  const hits = searchWorkspace(items, "japan");
  assert.deepEqual(hits.map((hit) => hit.label), ["Reis naar Japan", "Kafka op het strand", "Notities"]);
  assert.equal(hits[1].rowId, "r1");
  assert.equal(hits[1].context, "Boeken");
  assert.equal(hits[2].context, "Reis naar Japan");
  assert.match(hits[2].snippet, /Japan Rail Pass/);
});

test("every search word must match and trashed items are skipped", () => {
  assert.deepEqual(searchWorkspace(items, "kyoto trein").map((hit) => hit.id), ["trip"]);
  assert.deepEqual(searchWorkspace(items, "kyoto vliegtuig"), []);
  assert.deepEqual(searchWorkspace(items, "   "), []);
  assert.ok(!searchWorkspace(items, "oud").some((hit) => hit.id === "old"));
});

// Wednesday 10 June 2026, 14:00 local time.
const NOW = new Date(2026, 5, 10, 14, 0);
const local = (month: number, day: number, hour: number, minute = 0, year = 2026) => new Date(year, month - 1, day, hour, minute);
const parse = (text: string) => {
  const parsed = parseReminder(text, NOW);
  return parsed && { text: parsed.text, at: parsed.at.getTime() };
};

test("relative times", () => {
  assert.deepEqual(parse("over 20 min thee zetten"), { text: "Thee zetten", at: NOW.getTime() + 20 * 60_000 });
  assert.deepEqual(parse("bel mama over een uur"), { text: "Bel mama", at: NOW.getTime() + 60 * 60_000 });
  assert.deepEqual(parse("over een kwartier vertrekken"), { text: "Vertrekken", at: NOW.getTime() + 15 * 60_000 });
  assert.deepEqual(parse("over 2 dagen vuilnis"), { text: "Vuilnis", at: NOW.getTime() + 2 * 1440 * 60_000 });
});

test("days with and without a time", () => {
  assert.deepEqual(parse("morgen 9:00 tandarts bellen"), { text: "Tandarts bellen", at: local(6, 11, 9).getTime() });
  assert.deepEqual(parse("morgen tandarts"), { text: "Tandarts", at: local(6, 11, 9).getTime() });
  assert.deepEqual(parse("overmorgen om 16.30 ophalen"), { text: "Ophalen", at: local(6, 12, 16, 30).getTime() });
  assert.deepEqual(parse("vanavond vuilnis buiten"), { text: "Vuilnis buiten", at: local(6, 10, 20).getTime() });
  assert.deepEqual(parse("vandaag om 17 uur sporten"), { text: "Sporten", at: local(6, 10, 17).getTime() });
});

test("weekdays pick the next occurrence", () => {
  assert.deepEqual(parse("vrijdag 14:30 rapport inleveren"), { text: "Rapport inleveren", at: local(6, 12, 14, 30).getTime() });
  assert.deepEqual(parse("op maandag oudergesprek"), { text: "Oudergesprek", at: local(6, 15, 9).getTime() });
  assert.deepEqual(parse("woensdag 10:00 overleg"), { text: "Overleg", at: local(6, 17, 10).getTime() });
  assert.deepEqual(parse("woensdag 16:00 overleg"), { text: "Overleg", at: local(6, 10, 16).getTime() });
});

test("a time alone means today, or tomorrow when it has passed", () => {
  assert.deepEqual(parse("om 16:00 boodschappen"), { text: "Boodschappen", at: local(6, 10, 16).getTime() });
  assert.deepEqual(parse("8:15 medicijnen"), { text: "Medicijnen", at: local(6, 11, 8, 15).getTime() });
});

test("dates", () => {
  assert.deepEqual(parse("12-7 verjaardag Sanne"), { text: "Verjaardag Sanne", at: local(7, 12, 9).getTime() });
  assert.deepEqual(parse("3 maart 2027 10:00 APK"), { text: "APK", at: local(3, 3, 10, 0, 2027).getTime() });
  assert.deepEqual(parse("1-1 nieuwjaar"), { text: "Nieuwjaar", at: local(1, 1, 9, 0, 2027).getTime() });
});

test("text without a time, impossible times and a time without text are refused", () => {
  assert.equal(parse("tandarts bellen"), null);
  assert.equal(parse("morgen 25:00 slapen"), null);
  assert.equal(parse("31-2 niets"), null);
  assert.equal(parse("morgen 9:00"), null);
});

test("deep links", () => {
  assert.deepEqual(parseDeepLink("personal-space://note?text=Melk%20kopen"), { action: "note", text: "Melk kopen" });
  assert.deepEqual(parseDeepLink("personal-space://reminder?text=morgen%209%3A00%20bellen"), { action: "reminder", text: "morgen 9:00 bellen" });
  assert.deepEqual(parseDeepLink("personal-space://reminder?text=Bellen&at=2026-06-11T09:00:00Z"), { action: "reminder", text: "Bellen", at: "2026-06-11T09:00:00Z" });
  assert.deepEqual(parseDeepLink("personal-space://open?id=google-tasks&row=r1"), { action: "open", id: "google-tasks", rowId: "r1" });
  assert.deepEqual(parseDeepLink("personal-space://search?q=japan"), { action: "search", query: "japan" });
  assert.deepEqual(parseDeepLink("personal-space://note"), { action: "show" });
  assert.deepEqual(parseDeepLink("https://evil.example/note?text=x"), { action: "show" });
  assert.deepEqual(parseDeepLink("geen url"), { action: "show" });
});
