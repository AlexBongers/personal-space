import { GOOGLE_TASKS_DATABASE_ID, GOOGLE_TASK_PROPERTY_IDS } from "../app/personal-space/model.ts";
import { taskReminder } from "../app/personal-space/editor-model.ts";
import type { Database, Item } from "../app/personal-space/types.ts";
import type { NotifyState } from "./notifications.ts";

export type TaskReminder = { id: string; title: string; at: number };

const SOURCE = "task-reminders";
const REMEMBERED = 500;
const CATCH_UP_MS = 24 * 60 * 60_000;

/** Open tasks that have a reminder time. */
export const taskReminders = (items: Item[]): TaskReminder[] => {
  const tasks = items.find((item): item is Database => item.kind === "database" && item.id === GOOGLE_TASKS_DATABASE_ID && !item.trash);
  if (!tasks) return [];
  return tasks.rows
    .filter((row) => !row.trash && String(row.values[GOOGLE_TASK_PROPERTY_IDS.status] ?? "") !== "Done")
    .map((row) => ({ id: row.id, title: row.title, at: Date.parse(taskReminder(row)) }))
    .filter((reminder) => Number.isFinite(reminder.at))
    .sort((a, b) => a.at - b.at);
};

/**
 * Watches the reminder times on tasks. The task list is only read again when the workspace revision changes,
 * each reminder is announced once (also across restarts, through the notify state), and one that came due while
 * the app was closed is still announced if it is less than a day old.
 */
export const createTaskReminderWatch = (readRevision: () => number, readItems: () => Promise<Item[]>) => {
  let revision = -1;
  let reminders: TaskReminder[] = [];
  return {
    upcoming: () => reminders,
    due: async (now: Date, state: NotifyState) => {
      const current = readRevision();
      if (current !== revision) { reminders = taskReminders(await readItems()); revision = current; }
      const seen = state.seen[SOURCE] ?? [];
      const key = (reminder: TaskReminder) => `${reminder.id}@${reminder.at}`;
      const due = reminders.filter((reminder) => reminder.at <= now.getTime() && reminder.at > now.getTime() - CATCH_UP_MS && !seen.includes(key(reminder)));
      if (due.length) state.seen[SOURCE] = [...due.map(key), ...seen].slice(0, REMEMBERED);
      return due;
    },
  };
};
