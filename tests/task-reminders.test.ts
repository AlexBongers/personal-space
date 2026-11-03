import assert from "node:assert/strict";
import test from "node:test";
import { canSaveTask, reminderFromInput, reminderInput, reminderShortcuts, TASK_REMINDER, taskDraft, taskValues } from "../app/personal-space/editor-model.ts";
import { createGoogleTasksDatabase, GOOGLE_TASK_PROPERTY_IDS as TASK } from "../app/personal-space/model.ts";
import type { Row } from "../app/personal-space/types.ts";
import { googleTaskToRow } from "../worker/google-tasks-sync.ts";
import { createTaskReminderWatch, taskReminders } from "../desktop/task-reminders.ts";

const NOW = new Date("2026-06-10T14:20:00+02:00");
const row = (id: string, title: string, reminder: string, status = "Open"): Row => ({ id, title, blocks: [], values: { [TASK.status]: status, [TASK_REMINDER]: reminder } });
const workspace = (rows: Row[]) => { const tasks = createGoogleTasksDatabase(); tasks.rows = rows; return [tasks]; };

test("reminder shortcuts are in an hour, tonight at 20:00 and tomorrow at 09:00, in Amsterdam time", () => {
  assert.deepEqual(reminderShortcuts(NOW).map((entry) => entry.value), [
    "2026-06-10T13:30:00.000Z", "2026-06-10T18:00:00.000Z", "2026-06-11T07:00:00.000Z",
  ]);
  assert.equal(reminderShortcuts(new Date("2026-06-10T21:00:00+02:00"))[1].value, "2026-06-11T18:00:00.000Z");
});

test("a reminder round-trips through the time field and the row values", () => {
  assert.equal(reminderInput("2026-06-11T07:00:00.000Z"), "2026-06-11T09:00");
  assert.equal(reminderFromInput("2026-06-11T09:00"), "2026-06-11T07:00:00.000Z");
  assert.equal(reminderFromInput(""), "");
  const draft = { ...taskDraft(undefined), title: "Bellen", reminder: "2026-06-11T07:00:00.000Z" };
  assert.equal(taskValues(draft)[TASK_REMINDER], "2026-06-11T07:00:00.000Z");
  assert.equal(taskDraft(row("t", "Bellen", "2026-06-11T07:00:00.000Z")).reminder, "2026-06-11T07:00:00.000Z");
  assert.equal(canSaveTask({ ...draft, reminder: "morgen" }), false);
});

test("the Google sync keeps the reminder, which Google Tasks cannot store", () => {
  const local = row("t", "Bellen", "2026-06-11T07:00:00.000Z");
  const synced = googleTaskToRow({ id: "g1", title: "Bellen", status: "needsAction" }, "Werk", local);
  assert.equal(synced.values[TASK_REMINDER], "2026-06-11T07:00:00.000Z");
});

test("only open tasks with a valid time count", () => {
  const items = workspace([row("a", "Later", "2026-06-10T15:00:00+02:00"), row("b", "Klaar", "2026-06-10T15:00:00+02:00", "Done"), row("c", "Geen", ""), row("d", "Fout", "morgen")]);
  assert.deepEqual(taskReminders(items).map((entry) => entry.id), ["a"]);
});

test("each task reminder fires once, also after a restart, and old ones are not replayed", async () => {
  let revision = 1;
  let reads = 0;
  let rows = [row("a", "Bellen", "2026-06-10T14:15:00+02:00"), row("b", "Later", "2026-06-10T16:00:00+02:00"), row("old", "Vorige week", "2026-06-01T09:00:00+02:00")];
  const state = { seen: {}, lastBriefing: "" };
  const watch = createTaskReminderWatch(() => revision, async () => { reads++; return workspace(rows); });
  assert.deepEqual((await watch.due(NOW, state)).map((entry) => entry.id), ["a"]);
  assert.deepEqual(await watch.due(NOW, state), []);
  assert.equal(reads, 1);
  const restarted = createTaskReminderWatch(() => revision, async () => workspace(rows));
  assert.deepEqual(await restarted.due(new Date("2026-06-10T16:01:00+02:00"), state).then((due) => due.map((entry) => entry.id)), ["b"]);
  rows = [{ ...rows[0], values: { ...rows[0].values, [TASK_REMINDER]: "2026-06-10T17:00:00+02:00" } }];
  revision = 2;
  assert.deepEqual((await watch.due(new Date("2026-06-10T17:00:00+02:00"), state)).map((entry) => entry.id), ["a"]);
});
