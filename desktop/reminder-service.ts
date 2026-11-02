import { randomUUID } from "node:crypto";
import { parseReminder } from "./natural-time.ts";
import { addReminder, dueReminders, loadReminders, removeReminder, saveReminders, settle, snooze, type Reminder, type ReminderInput } from "./reminders.ts";

const NO_TIME = "Ik zie geen tijdstip. Probeer bijvoorbeeld 'morgen 9:00 tandarts bellen' of 'over 20 min thee'.";

const localDate = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
const message = (error: unknown) => error instanceof Error ? error.message : String(error);

/** Reminders live in memory and are written to reminders.json on every change, so the 15-second check never reads the disk. */
export const createReminderService = (file: string, onChange: () => void = () => {}) => {
  let reminders: Reminder[] = loadReminders(file);
  const save = (next: Reminder[]) => {
    reminders = next;
    saveReminders(file, reminders);
    onChange();
    return reminders;
  };

  return {
    list: () => reminders,
    add: (input: ReminderInput) => save(addReminder(reminders, input, randomUUID())),
    remove: (id: string) => save(removeReminder(reminders, id)),
    /** "morgen 9:00 tandarts bellen" becomes a reminder; an explicit `at` skips the parsing. */
    addFromText: (text: string, popup: boolean, at?: string, now = new Date()) => {
      const parsed = at ? { text, at: new Date(at) } : parseReminder(text, now);
      if (!parsed) return { error: NO_TIME } as const;
      try {
        save(addReminder(reminders, { text: parsed.text, at: parsed.at.toISOString(), repeat: "none", popup }, randomUUID()));
        return { reminders, text: parsed.text, at: parsed.at } as const;
      } catch (error) {
        return { error: message(error) } as const;
      }
    },
    snooze: (text: string, minutes: number, now = new Date()) =>
      save(settle(reminders, [], now, [snooze({ id: randomUUID(), text, at: "", repeat: "none", popup: true }, minutes, now)])),
    /** Returns what is due and already moves it on, so a pop-up that stays open never fires twice. */
    takeDue: (now = new Date()) => {
      const due = dueReminders(reminders, now);
      if (due.length) save(settle(reminders, due, now));
      return due;
    },
    countOn: (day: Date) => reminders.filter((reminder) => localDate(new Date(reminder.at)) === localDate(day)).length,
  };
};
