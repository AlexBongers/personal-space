import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { addReminder, afterFiring, dueReminders, loadReminders, removeReminder, saveReminders, settle, snooze, type Reminder } from "../desktop/reminders.ts";
import { REMINDERS_HTML } from "../desktop/reminders-ui.ts";

const NOW = new Date("2026-06-10T10:00:00Z");
const input = (overrides: Record<string, unknown> = {}) => ({ text: "Bel de huisarts", at: "2026-06-10T11:00:00Z", repeat: "none", popup: false, ...overrides });

test("a valid reminder is added and the list stays sorted by time", () => {
  const first = addReminder([], input({ at: "2026-06-10T15:00:00Z" }), "a");
  const both = addReminder(first, input({ text: "Eerder", at: "2026-06-10T11:00:00Z" }), "b");
  assert.deepEqual(both.map((reminder) => reminder.id), ["b", "a"]);
  assert.equal(both[0].at, "2026-06-10T11:00:00.000Z");
});

test("invalid reminders are refused with a readable message", () => {
  assert.throws(() => addReminder([], input({ text: "   " }), "a"), /tekst/);
  assert.throws(() => addReminder([], input({ at: "" }), "a"), /tijdstip/);
  assert.throws(() => addReminder([], input({ at: "morgen" }), "a"), /tijdstip/);
});

test("unknown repeat values fall back to a single reminder and popup must be true", () => {
  const [reminder] = addReminder([], input({ repeat: "hourly", popup: "yes" }), "a");
  assert.equal(reminder.repeat, "none");
  assert.equal(reminder.popup, false);
});

test("only reminders that are due are returned", () => {
  const list = addReminder(addReminder([], input({ at: "2026-06-10T09:59:00Z" }), "past"), input({ at: "2026-06-10T10:01:00Z" }), "future");
  assert.deepEqual(dueReminders(list, NOW).map((reminder) => reminder.id), ["past"]);
});

test("a single reminder disappears after firing, a repeating one moves to the next future time", () => {
  const single = addReminder([], input({ at: "2026-06-10T09:00:00Z" }), "s")[0];
  assert.equal(afterFiring(single, NOW), null);
  const daily = addReminder([], input({ at: "2026-06-07T09:00:00Z", repeat: "daily" }), "d")[0];
  assert.equal(afterFiring(daily, NOW)?.at, "2026-06-11T09:00:00.000Z");
  const weekly = addReminder([], input({ at: "2026-06-01T09:00:00Z", repeat: "weekly" }), "w")[0];
  assert.equal(afterFiring(weekly, NOW)?.at, "2026-06-15T09:00:00.000Z");
});

test("settle replaces fired reminders and keeps the rest and snoozed copies", () => {
  const list = addReminder(addReminder([], input({ at: "2026-06-10T09:00:00Z", repeat: "daily" }), "daily"), input({ at: "2026-06-10T18:00:00Z" }), "later");
  const next = settle(list, dueReminders(list, NOW), NOW, [snooze({ id: "z", text: "Uitgesteld", at: "", repeat: "none", popup: true }, 10, NOW)]);
  assert.deepEqual(next.map((reminder) => [reminder.id, reminder.at]), [["z", "2026-06-10T10:10:00.000Z"], ["later", "2026-06-10T18:00:00.000Z"], ["daily", "2026-06-11T09:00:00.000Z"]]);
});

test("snoozing a repeating reminder makes a single one", () => {
  const snoozed = snooze({ id: "a", text: "x", at: "2026-06-10T09:00:00Z", repeat: "daily", popup: false }, 60, NOW);
  assert.equal(snoozed.repeat, "none");
  assert.equal(snoozed.at, "2026-06-10T11:00:00.000Z");
});

test("reminders can be removed and survive a restart", () => {
  const path = join(mkdtempSync(join(tmpdir(), "ps-rem-")), "reminders.json");
  assert.deepEqual(loadReminders(path), []);
  const list: Reminder[] = addReminder(addReminder([], input(), "a"), input({ text: "Tweede" }), "b");
  saveReminders(path, list);
  assert.equal(loadReminders(path).length, 2);
  assert.deepEqual(removeReminder(loadReminders(path), "a").map((reminder) => reminder.id), ["b"]);
});

test("the reminders window only uses the preload bridge", () => {
  for (const call of ["reminders.list", "reminders.add", "reminders.remove", "reminders.close"]) assert.ok(REMINDERS_HTML.includes(call), call);
  assert.match(REMINDERS_HTML, /Content-Security-Policy/);
});
