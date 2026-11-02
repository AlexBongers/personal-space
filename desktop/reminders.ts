import { existsSync, readFileSync, writeFileSync } from "node:fs";

export type Repeat = "none" | "daily" | "weekly";
export type Reminder = { id: string; text: string; at: string; repeat: Repeat; popup: boolean };
export type ReminderInput = { text: unknown; at: unknown; repeat: unknown; popup: unknown };

const DAY_MS = 24 * 60 * 60 * 1000;

export const loadReminders = (path: string): Reminder[] => existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) as Reminder[] : [];
export const saveReminders = (path: string, reminders: Reminder[]) => writeFileSync(path, `${JSON.stringify(reminders, null, 2)}\n`);

const byTime = (a: Reminder, b: Reminder) => a.at.localeCompare(b.at);

/** Validates a new reminder from the form. Throws a message that can be shown to the user. */
export const addReminder = (reminders: Reminder[], input: ReminderInput, id: string): Reminder[] => {
  const text = String(input.text ?? "").trim();
  if (!text) throw new Error("Vul een tekst in.");
  const at = new Date(String(input.at));
  if (Number.isNaN(at.getTime())) throw new Error("Kies een geldig tijdstip.");
  const repeat: Repeat = input.repeat === "daily" || input.repeat === "weekly" ? input.repeat : "none";
  return [...reminders, { id, text, at: at.toISOString(), repeat, popup: input.popup === true }].sort(byTime);
};

export const removeReminder = (reminders: Reminder[], id: string) => reminders.filter((reminder) => reminder.id !== id);

export const dueReminders = (reminders: Reminder[], now: Date) => reminders.filter((reminder) => new Date(reminder.at).getTime() <= now.getTime());

/** After a reminder fired: a repeating one moves to its next future time, a single one is removed (null). */
export const afterFiring = (reminder: Reminder, now: Date): Reminder | null => {
  if (reminder.repeat === "none") return null;
  const step = (reminder.repeat === "daily" ? 1 : 7) * DAY_MS;
  let next = new Date(reminder.at).getTime();
  while (next <= now.getTime()) next += step;
  return { ...reminder, at: new Date(next).toISOString() };
};

export const snooze = (reminder: Reminder, minutes: number, now: Date): Reminder => ({ ...reminder, repeat: "none", at: new Date(now.getTime() + minutes * 60_000).toISOString() });

/** Replaces the fired reminders by their next occurrence, and adds snoozed copies. */
export const settle = (reminders: Reminder[], fired: Reminder[], now: Date, snoozed: Reminder[] = []) => {
  const firedIds = new Set(fired.map((reminder) => reminder.id));
  const next = fired.map((reminder) => afterFiring(reminder, now)).filter((reminder): reminder is Reminder => reminder !== null);
  return [...reminders.filter((reminder) => !firedIds.has(reminder.id)), ...next, ...snoozed].sort(byTime);
};
