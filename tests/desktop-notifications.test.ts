import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { DEFAULT_SETTINGS, loadSettings } from "../desktop/config.ts";
import { briefingDue, briefingText, freshMessages, loadNotifyState, saveNotifyState } from "../desktop/notifications.ts";

const message = (id: string, unread = true) => ({ id, unread });

test("the first check only records messages, later checks announce new unread ones once", () => {
  const state = { seen: {}, lastBriefing: "" };
  assert.deepEqual(freshMessages(state, "parro", [message("a"), message("b")]), []);
  assert.deepEqual(freshMessages(state, "parro", [message("c"), message("d", false), message("a")]).map((entry) => entry.id), ["c"]);
  assert.deepEqual(freshMessages(state, "parro", [message("c"), message("a")]), []);
  assert.deepEqual(freshMessages(state, "gmail", [message("x")]), []);
});

test("the announced messages survive a restart", () => {
  const path = join(mkdtempSync(join(tmpdir(), "ps-notify-")), "notify-state.json");
  assert.deepEqual(loadNotifyState(path), { seen: {}, lastBriefing: "" });
  const state = loadNotifyState(path);
  freshMessages(state, "gmail", [message("a")]);
  state.lastBriefing = "2026-06-10";
  saveNotifyState(path, state);
  const reloaded = loadNotifyState(path);
  assert.equal(reloaded.lastBriefing, "2026-06-10");
  assert.deepEqual(freshMessages(reloaded, "gmail", [message("a"), message("b")]).map((entry) => entry.id), ["b"]);
});

test("the briefing comes once per day from the configured time", () => {
  const morning = new Date(2026, 5, 10, 7, 29);
  const later = new Date(2026, 5, 10, 9, 15);
  assert.equal(briefingDue(morning, "07:30", ""), false);
  assert.equal(briefingDue(later, "07:30", ""), true);
  assert.equal(briefingDue(later, "07:30", "2026-06-10"), false);
  assert.equal(briefingDue(new Date(2026, 5, 11, 7, 30), "07:30", "2026-06-10"), true);
  assert.equal(briefingDue(later, "", ""), false);
  assert.equal(briefingDue(later, "half acht", ""), false);
});

test("the briefing text counts the day", () => {
  const day = { events: [{ id: "e", title: "Teamoverleg", label: "09:00  Teamoverleg", start: 0 }, { id: "f", title: "Tandarts", label: "14:00  Tandarts", start: 0 }], tasks: [{ id: "t", label: "Boodschappen" }], dueCount: 1 };
  assert.equal(briefingText(day, 1), "2 afspraken, 1 taak, 1 herinnering. Eerste: 09:00 Teamoverleg.");
  assert.equal(briefingText({ events: [], tasks: [], dueCount: 0 }, 0), "Niets gepland vandaag. Geniet ervan.");
});

test("settings fall back to defaults for missing or wrong values", () => {
  const dir = mkdtempSync(join(tmpdir(), "ps-settings-"));
  writeFileSync(join(dir, "config.json"), JSON.stringify({ googleClientId: "x", googleClientSecret: "y", googleCalendarSyncOnly: "", briefingTime: "08:00", notifyGmail: false, eventReminderMinutes: "tien" }));
  assert.deepEqual(loadSettings(dir), { ...DEFAULT_SETTINGS, briefingTime: "08:00", notifyGmail: false });
  const fresh = mkdtempSync(join(tmpdir(), "ps-settings-"));
  assert.deepEqual(loadSettings(fresh), DEFAULT_SETTINGS);
});
