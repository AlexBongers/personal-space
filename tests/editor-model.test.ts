import assert from "node:assert/strict";
import test from "node:test";
import {
  addDays, canMoveEvent, canMoveTask, canSaveEvent, canSaveTask, dueShortcuts, durationMinutes, eventDraft, eventValues,
  localDateKey, moveEventValues, newEventTimes, taskDraft, taskListNames, taskValues, withDuration, withStart,
} from "../app/personal-space/editor-model.ts";
import { GOOGLE_CALENDAR_PROPERTY_IDS as CAL, GOOGLE_TASK_PROPERTY_IDS as TASK } from "../app/personal-space/model.ts";
import type { Row } from "../app/personal-space/types.ts";

const row = (id: string, title: string, values: Row["values"]): Row => ({ id, title, values, blocks: [] });
// Wednesday 10 June 2026, 14:20 in Amsterdam (summer time, UTC+2).
const NOW = new Date("2026-06-10T14:20:00+02:00");
const at = (local: string) => new Date(`${local}:00+02:00`).toISOString();

test("a new task draft is empty and only saveable with a title", () => {
  const draft = taskDraft(undefined, { list: "Werk" });
  assert.deepEqual(draft, { title: "", list: "Werk", due: "", notes: "", done: false, reminder: "" });
  assert.equal(canSaveTask(draft), false);
  assert.equal(canSaveTask({ ...draft, title: "  " }), false);
  assert.equal(canSaveTask({ ...draft, title: "Bellen" }), true);
  assert.equal(canSaveTask({ ...draft, title: "Bellen", due: "2026-02-31" }), false);
});

test("a task draft round-trips through the row values", () => {
  const existing = row("t", "Rapport", { [TASK.status]: "Done", [TASK.list]: "Werk", [TASK.due]: "2026-06-12T00:00:00.000Z", [TASK.notes]: "Hoofdstuk 3" });
  const draft = taskDraft(existing);
  assert.deepEqual(draft, { title: "Rapport", list: "Werk", due: "2026-06-12", notes: "Hoofdstuk 3", done: true, reminder: "" });
  assert.deepEqual(taskValues({ ...draft, done: false, list: " Privé " }), { [TASK.status]: "Open", [TASK.list]: "Privé", [TASK.due]: "2026-06-12", [TASK.notes]: "Hoofdstuk 3", "task-reminder": "" });
});

test("task lists are listed once, alphabetically", () => {
  const rows = [row("a", "", { [TASK.list]: "Werk" }), row("b", "", { [TASK.list]: "Privé" }), row("c", "", { [TASK.list]: "Werk" }), row("d", "", {})];
  assert.deepEqual(taskListNames(rows), ["Privé", "Werk"]);
});

test("deadline shortcuts are today, tomorrow and next Monday", () => {
  assert.deepEqual(dueShortcuts(NOW).map((entry) => entry.value), ["2026-06-10", "2026-06-11", "2026-06-15"]);
  assert.equal(dueShortcuts(new Date("2026-06-15T09:00:00+02:00")).at(-1)?.value, "2026-06-22");
});

test("a task with subtasks cannot be moved to another list", () => {
  const parent = row("p", "Verhuizen", { [TASK.id]: "g-1" });
  const child = row("c", "Dozen", { [TASK.id]: "g-2", [TASK.parent]: "g-1" });
  assert.equal(canMoveTask(parent, [parent, child]), false);
  assert.equal(canMoveTask(child, [parent, child]), true);
  assert.equal(canMoveTask(parent, [parent, { ...child, trash: { deletedAt: "x", batchId: "b", rootId: "c" } }]), true);
  assert.equal(canMoveTask(row("n", "Nieuw", {}), [parent, child]), true);
});

test("a new appointment starts at the next whole hour today, or at 09:00 another day, for one hour", () => {
  assert.deepEqual(newEventTimes("2026-06-10", NOW), { date: "2026-06-10", startTime: "15:00", endDate: "2026-06-10", endTime: "16:00" });
  assert.deepEqual(newEventTimes("2026-06-12", NOW), { date: "2026-06-12", startTime: "09:00", endDate: "2026-06-12", endTime: "10:00" });
  assert.deepEqual(newEventTimes("2026-06-10", new Date("2026-06-10T23:30:00+02:00")), { date: "2026-06-10", startTime: "23:00", endDate: "2026-06-11", endTime: "00:00" });
  const draft = eventDraft(undefined, "2026-06-12", NOW);
  assert.equal(draft.allDay, false);
  assert.equal(canSaveEvent(draft), false);
  assert.equal(canSaveEvent({ ...draft, title: "Tandarts" }), true);
});

test("a timed appointment round-trips through the row values", () => {
  const draft = { ...eventDraft(undefined, "2026-06-12", NOW), title: "Tandarts", location: " Bunnik " };
  const values = eventValues(draft);
  assert.equal(values[CAL.allDay], false);
  assert.equal(values[CAL.start], at("2026-06-12T09:00"));
  assert.equal(values[CAL.end], at("2026-06-12T10:00"));
  assert.equal(values[CAL.location], "Bunnik");
  const back = eventDraft(row("e", "Tandarts", values), "2026-01-01", NOW);
  assert.deepEqual([back.date, back.startTime, back.endDate, back.endTime, back.allDay], ["2026-06-12", "09:00", "2026-06-12", "10:00", false]);
});

test("an all-day appointment shows its last day and stores the day after, like Google", () => {
  const stored = row("e", "Vakantie", { [CAL.allDay]: true, [CAL.start]: "2026-07-01", [CAL.end]: "2026-07-04" });
  const draft = eventDraft(stored, "2026-01-01", NOW);
  assert.deepEqual([draft.date, draft.endDate], ["2026-07-01", "2026-07-03"]);
  assert.deepEqual([eventValues(draft)[CAL.start], eventValues(draft)[CAL.end]], ["2026-07-01", "2026-07-04"]);
  const single = eventDraft(row("s", "Verjaardag", { [CAL.allDay]: true, [CAL.start]: "2026-07-01", [CAL.end]: "" }), "2026-01-01", NOW);
  assert.equal(single.endDate, "2026-07-01");
});

test("an appointment that ends before it starts cannot be saved", () => {
  const draft = { ...eventDraft(undefined, "2026-06-12", NOW), title: "X" };
  assert.equal(canSaveEvent({ ...draft, endTime: "08:00" }), false);
  assert.equal(canSaveEvent({ ...draft, endTime: "09:00" }), false);
  assert.equal(canSaveEvent({ ...draft, allDay: true, endDate: "2026-06-11" }), false);
});

test("moving the start keeps the length, and duration buttons set the end", () => {
  const draft = { ...eventDraft(undefined, "2026-06-12", NOW), title: "X" };
  const longer = withDuration(draft, 90);
  assert.equal(longer.endTime, "10:30");
  assert.equal(durationMinutes(longer), 90);
  const moved = withStart(longer, "2026-06-13", "23:00");
  assert.deepEqual([moved.date, moved.startTime, moved.endDate, moved.endTime], ["2026-06-13", "23:00", "2026-06-14", "00:30"]);
  const allDay = withStart({ ...draft, allDay: true, endDate: "2026-06-14" }, "2026-06-20", "09:00");
  assert.deepEqual([allDay.date, allDay.endDate], ["2026-06-20", "2026-06-22"]);
});

test("dragging an appointment to another day keeps its times", () => {
  const timed = row("e", "Overleg", { [CAL.start]: at("2026-06-10T10:00"), [CAL.end]: at("2026-06-10T11:30") });
  const moved = moveEventValues(timed, "2026-06-10", "2026-06-12");
  assert.equal(moved[CAL.start], at("2026-06-12T10:00"));
  assert.equal(moved[CAL.end], at("2026-06-12T11:30"));
  const allDay = row("a", "Vakantie", { [CAL.allDay]: true, [CAL.start]: "2026-06-29", [CAL.end]: "2026-07-02" });
  assert.deepEqual(moveEventValues(allDay, "2026-06-30", "2026-07-03"), { [CAL.start]: "2026-07-02", [CAL.end]: "2026-07-05" });
  assert.equal(canMoveEvent(allDay), true);
  assert.equal(canMoveEvent(row("r", "Sport", { [CAL.recurrence]: "RRULE:FREQ=WEEKLY" })), false);
});

test("date helpers cross month ends and daylight saving changes", () => {
  assert.equal(addDays("2026-03-28", 2), "2026-03-30");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(localDateKey(new Date("2026-10-24T22:30:00Z")), "2026-10-25");
});

test("appointments keep their Amsterdam clock time across the switch to winter time", () => {
  // Summer time ends on Sunday 25 October 2026; a 10:00 meeting on Friday stays at 10:00 on Monday.
  const friday = row("f", "Overleg", { [CAL.start]: "2026-10-23T08:00:00.000Z", [CAL.end]: "2026-10-23T09:00:00.000Z" });
  assert.deepEqual(moveEventValues(friday, "2026-10-23", "2026-10-26"), { [CAL.start]: "2026-10-26T09:00:00.000Z", [CAL.end]: "2026-10-26T10:00:00.000Z" });
  const draft = { ...eventDraft(undefined, "2026-10-26", NOW), title: "Na de wissel" };
  assert.equal(eventValues(draft)[CAL.start], "2026-10-26T08:00:00.000Z");
});
