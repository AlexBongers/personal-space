import { getValue, GOOGLE_TASK_PROPERTY_IDS, valueText } from "./model.ts";
import {
  CALENDAR_TIME_ZONE,
  calendarDateKey,
  calendarEventIsCancelled,
  parseCalendarEvent,
  selectCalendarEventsForDay,
  selectHomeCalendar,
} from "./calendar-model.ts";
import type { CalendarEvent } from "./calendar-model.ts";
import type { Row } from "./types.ts";

/** Compatibility exports for Home and existing selector tests. */
export const HOME_TIME_ZONE = CALENDAR_TIME_ZONE;
export const homeDateKey = calendarDateKey;
export const homeTodayKey = (now = new Date(), timeZone = HOME_TIME_ZONE) => calendarDateKey(now, timeZone);
export { calendarEventIsCancelled, parseCalendarEvent as calendarEvent, selectCalendarEventsForDay, selectHomeCalendar };
export type HomeCalendarEvent = CalendarEvent;

const rowText = (row: Row, propertyId: string) => valueText(getValue(row, propertyId)).trim();

export const taskIsDone = (row: Row) => ["done", "completed", "complete"].includes(
  rowText(row, GOOGLE_TASK_PROPERTY_IDS.status).toLowerCase(),
);

const isValidDateKey = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const validDueKey = (row: Row) => {
  const value = rowText(row, GOOGLE_TASK_PROPERTY_IDS.due).slice(0, 10);
  return isValidDateKey(value) ? value : "";
};

const compareRows = (first: Row, second: Row) => first.title.localeCompare(second.title, undefined, { sensitivity: "base" }) || first.id.localeCompare(second.id);

export type HomeTaskSelection = {
  today: Row[];
  overdue: Row[];
  future: Row[];
  undated: Row[];
  open: Row[];
  todayKey: string;
};

export const selectHomeTasks = (rows: Row[], now = new Date(), timeZone = HOME_TIME_ZONE): HomeTaskSelection => {
  const todayKey = homeTodayKey(now, timeZone);
  const open = rows.filter((row) => !row.trash && !taskIsDone(row));
  const byDueThenTitle = (first: Row, second: Row) => {
    const firstDue = validDueKey(first);
    const secondDue = validDueKey(second);
    return firstDue.localeCompare(secondDue) || compareRows(first, second);
  };
  const today = open.filter((row) => validDueKey(row) === todayKey).sort(byDueThenTitle);
  const overdue = open.filter((row) => {
    const due = validDueKey(row);
    return Boolean(due) && due < todayKey;
  }).sort(byDueThenTitle);
  const future = open.filter((row) => validDueKey(row) > todayKey).sort(byDueThenTitle);
  const undated = open.filter((row) => !validDueKey(row)).sort(compareRows);
  return { today, overdue, future, undated, open, todayKey };
};

export const taskDueKey = (row: Row) => validDueKey(row);
export const calendarRowText = rowText;
