import { CALENDAR_TIME_ZONE } from "./calendar-model.ts";
import { GOOGLE_CALENDAR_DEFAULT_ATTENDEE, GOOGLE_CALENDAR_PROPERTY_IDS as CAL, GOOGLE_TASK_PROPERTY_IDS as TASK, getValue, valueText } from "./model.ts";
import type { CellValue, Row } from "./types.ts";

/**
 * Drafts for the task and appointment editors. The editor works on a draft and the row is only created or
 * changed when the draft is saved, so cancelling never leaves an empty task or appointment behind.
 * Dates and times are in Europe/Amsterdam, like the rest of the calendar, whatever time zone the computer is in.
 */

const text = (row: Row | undefined, propertyId: string) => row ? valueText(getValue(row, propertyId)).trim() : "";
const pad = (value: number) => String(value).padStart(2, "0");

const parts = new Intl.DateTimeFormat("en-CA", { timeZone: CALENDAR_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** The Amsterdam date and time of a moment. */
const zoned = (moment: Date) => {
  const value = Object.fromEntries(parts.formatToParts(moment).map((part) => [part.type, part.value]));
  return { date: `${value.year}-${value.month}-${value.day}`, time: `${value.hour}:${value.minute}` };
};

/** The date key (YYYY-MM-DD) of a moment in Amsterdam. */
export const localDateKey = (moment: Date) => zoned(moment).date;

const utcOf = (date: string, time: string) => Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10), +time.slice(0, 2), +time.slice(3, 5));
const offsetAt = (ms: number) => { const local = zoned(new Date(ms)); return utcOf(local.date, local.time) - Math.floor(ms / 60_000) * 60_000; };

/** The moment of an Amsterdam date and time; the offset is checked twice so the summer-time switch is right. */
const instant = (date: string, time: string) => {
  const guess = utcOf(date, time);
  return new Date(guess - offsetAt(guess - offsetAt(guess)));
};

const isDateKey = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
const isTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

/** Calendar-day arithmetic on date keys, independent of time zones. */
export const addDays = (key: string, amount: number) => {
  const date = new Date(`${key}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
};

const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);

/* ---------------------------------------------------------------- Tasks */

/**
 * A reminder time on a task, as an ISO moment. Google Tasks only knows a due date, so the time stays in this
 * app: the sync keeps it, and the desktop app shows a notification when it comes.
 */
export const TASK_REMINDER = "task-reminder";

export const taskReminder = (row: Row) => text(row, TASK_REMINDER);

export type TaskDraft = { title: string; list: string; due: string; notes: string; done: boolean; reminder: string };

const isDone = (row: Row) => ["done", "completed", "complete"].includes(text(row, TASK.status).toLowerCase());

export const taskDraft = (row?: Row, defaults: Partial<TaskDraft> = {}): TaskDraft => row
  ? { title: row.title, list: text(row, TASK.list), due: text(row, TASK.due).slice(0, 10), notes: text(row, TASK.notes), done: isDone(row), reminder: taskReminder(row) }
  : { title: "", list: "", due: "", notes: "", done: false, reminder: "", ...defaults };

export const taskValues = (draft: TaskDraft): Record<string, CellValue> => ({
  [TASK.status]: draft.done ? "Done" : "Open",
  [TASK.list]: draft.list.trim(),
  [TASK.due]: draft.due,
  [TASK.notes]: draft.notes.trim(),
  [TASK_REMINDER]: draft.reminder,
});

export const canSaveTask = (draft: TaskDraft) => draft.title.trim() !== "" && (!draft.due || isDateKey(draft.due))
  && (!draft.reminder || !Number.isNaN(Date.parse(draft.reminder)));

export type ReminderShortcut = { key: "inHour" | "tonight" | "tomorrowMorning"; value: string };

/** In an hour (on the quarter), tonight at 20:00 (or tomorrow evening when it is later), and tomorrow at 09:00. */
export const reminderShortcuts = (now = new Date()): ReminderShortcut[] => {
  const today = localDateKey(now);
  const inHour = new Date(Math.ceil((now.getTime() + 60 * 60_000) / (15 * 60_000)) * 15 * 60_000);
  const tonight = instant(today, "20:00");
  return [
    { key: "inHour", value: inHour.toISOString() },
    { key: "tonight", value: (tonight > now ? tonight : instant(addDays(today, 1), "20:00")).toISOString() },
    { key: "tomorrowMorning", value: instant(addDays(today, 1), "09:00").toISOString() },
  ];
};

/** The Amsterdam date and time of a reminder, for a datetime-local field, and back. */
export const reminderInput = (value: string) => {
  if (!value || Number.isNaN(Date.parse(value))) return "";
  const local = zoned(new Date(value));
  return `${local.date}T${local.time}`;
};
export const reminderFromInput = (value: string) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ? instant(value.slice(0, 10), value.slice(11, 16)).toISOString() : "";

/** The lists the tasks use, in alphabetical order. */
export const taskListNames = (rows: Row[]) => [...new Set(rows.map((row) => text(row, TASK.list)).filter(Boolean))].sort((a, b) => a.localeCompare(b));

export type DueShortcut = { key: "today" | "tomorrow" | "nextWeek"; value: string };

/** Today, tomorrow and next Monday. */
export const dueShortcuts = (now = new Date()): DueShortcut[] => {
  const today = localDateKey(now);
  const untilMonday = ((8 - new Date(`${today}T12:00:00Z`).getUTCDay()) % 7) || 7;
  return [
    { key: "today", value: today },
    { key: "tomorrow", value: addDays(today, 1) },
    { key: "nextWeek", value: addDays(today, untilMonday) },
  ];
};

/**
 * A task with subtasks stays in its list: Google removes subtasks together with their parent, so moving it
 * (which creates a copy in the new list and removes the original) would lose them.
 */
export const canMoveTask = (row: Row, rows: Row[]) => {
  const googleId = text(row, TASK.id);
  return !googleId || !rows.some((entry) => !entry.trash && text(entry, TASK.parent) === googleId);
};

/* --------------------------------------------------------- Appointments */

export type EventDraft = {
  title: string;
  allDay: boolean;
  date: string;
  /** Last day, inclusive. Equal to `date` for a one-day appointment. */
  endDate: string;
  startTime: string;
  endTime: string;
  calendar: string;
  calendarId: string;
  location: string;
  attendees: string;
  recurrence: string;
  notes: string;
};

const parseStored = (value: string) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return { date: value, time: "" };
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? { date: "", time: "" } : zoned(parsed);
};

const plusMinutes = (date: string, time: string, minutes: number) => zoned(new Date(instant(date, time).getTime() + minutes * 60_000));

/** A new appointment on `day`: today from the next whole hour, another day from 09:00, for one hour. */
export const newEventTimes = (day: string, now = new Date()) => {
  const startHour = day === localDateKey(now) ? Math.min(Number(zoned(now).time.slice(0, 2)) + 1, 23) : 9;
  const startTime = `${pad(startHour)}:00`;
  const end = plusMinutes(day, startTime, 60);
  return { date: day, startTime, endDate: end.date, endTime: end.time };
};

export const eventDraft = (row: Row | undefined, day: string, now = new Date()): EventDraft => {
  if (!row) {
    return { title: "", allDay: false, ...newEventTimes(day, now), calendar: "", calendarId: "", location: "", attendees: GOOGLE_CALENDAR_DEFAULT_ATTENDEE, recurrence: "", notes: "" };
  }
  const start = parseStored(text(row, CAL.start));
  const end = parseStored(text(row, CAL.end));
  const allDay = getValue(row, CAL.allDay) === true || String(getValue(row, CAL.allDay)) === "true" || (start.date !== "" && start.time === "");
  const date = start.date || day;
  // Google stores the end of an all-day appointment as the day after; the editor shows the last day.
  const endDate = allDay ? (end.date && end.date > date ? addDays(end.date, -1) : date) : end.date || date;
  const fallback = plusMinutes(date, start.time || "09:00", 60);
  return {
    title: row.title,
    allDay,
    date,
    endDate,
    startTime: start.time || "09:00",
    endTime: end.time || fallback.time,
    calendar: text(row, CAL.calendar),
    calendarId: text(row, CAL.calendarId),
    location: text(row, CAL.location),
    attendees: text(row, CAL.attendees),
    recurrence: text(row, CAL.recurrence),
    notes: text(row, CAL.notes),
  };
};

const iso = (date: string, time: string) => instant(date, time).toISOString();

export const canSaveEvent = (draft: EventDraft) =>
  draft.title.trim() !== "" && isDateKey(draft.date) && isDateKey(draft.endDate) && draft.endDate >= draft.date
  && (draft.allDay || (isTime(draft.startTime) && isTime(draft.endTime) && iso(draft.endDate, draft.endTime) > iso(draft.date, draft.startTime)));

export const eventValues = (draft: EventDraft): Record<string, CellValue> => ({
  [CAL.allDay]: draft.allDay,
  [CAL.start]: draft.allDay ? draft.date : iso(draft.date, draft.startTime),
  [CAL.end]: draft.allDay ? addDays(draft.endDate, 1) : iso(draft.endDate, draft.endTime),
  [CAL.calendar]: draft.calendar,
  [CAL.calendarId]: draft.calendarId,
  [CAL.location]: draft.location.trim(),
  [CAL.attendees]: draft.attendees.trim(),
  [CAL.recurrence]: draft.recurrence,
  [CAL.notes]: draft.notes.trim(),
});

/** Changing the start keeps the length of the appointment, like most calendar apps. */
export const withStart = (draft: EventDraft, date: string, startTime: string): EventDraft => {
  if (draft.allDay) return { ...draft, date, endDate: addDays(date, Math.max(0, daysBetween(draft.date, draft.endDate))) };
  const length = isTime(draft.startTime) && isTime(draft.endTime) ? (new Date(iso(draft.endDate, draft.endTime)).getTime() - new Date(iso(draft.date, draft.startTime)).getTime()) / 60_000 : 60;
  const end = plusMinutes(date, startTime, length > 0 ? length : 60);
  return { ...draft, date, startTime, endDate: end.date, endTime: end.time };
};

export const withDuration = (draft: EventDraft, minutes: number): EventDraft => {
  const end = plusMinutes(draft.date, draft.startTime, minutes);
  return { ...draft, endDate: end.date, endTime: end.time };
};

export const durationMinutes = (draft: EventDraft) =>
  draft.allDay ? 0 : Math.round((new Date(iso(draft.endDate, draft.endTime)).getTime() - new Date(iso(draft.date, draft.startTime)).getTime()) / 60_000);

/** Events from a read-only calendar such as Birthdays come from Google and cannot be changed here. */
export const isReadOnlyEvent = (row: Row) => getValue(row, CAL.readOnly) === true;

/** Recurring and read-only appointments are not dragged: moving one would move a whole series, or cannot reach Google. */
export const canMoveEvent = (row: Row) => !text(row, CAL.recurrence) && !isReadOnlyEvent(row);

/** Moves an appointment from one day to another, keeping its times and length. */
export const moveEventValues = (row: Row, fromDay: string, toDay: string): Record<string, CellValue> => {
  const shift = daysBetween(fromDay, toDay);
  const move = (value: string) => {
    if (!value) return value;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return addDays(value, shift);
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    const local = zoned(parsed);
    return iso(addDays(local.date, shift), local.time);
  };
  return { [CAL.start]: move(text(row, CAL.start)), [CAL.end]: move(text(row, CAL.end)) };
};
