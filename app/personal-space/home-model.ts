import {
  getValue,
  GOOGLE_CALENDAR_PROPERTY_IDS,
  GOOGLE_TASK_PROPERTY_IDS,
  valueText,
} from "./model.ts";
import type { Row } from "./types.ts";

export const HOME_TIME_ZONE = "Europe/Amsterdam";

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const formatterCache = new Map<string, Intl.DateTimeFormat>();
const datePartsFormatter = (timeZone: string) => {
  const key = `date-parts:${timeZone}`;
  const existing = formatterCache.get(key);
  if (existing) return existing;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  formatterCache.set(key, formatter);
  return formatter;
};

const timePartsFormatter = (timeZone: string) => {
  const key = `time-parts:${timeZone}`;
  const existing = formatterCache.get(key);
  if (existing) return existing;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  formatterCache.set(key, formatter);
  return formatter;
};

const isValidDateKey = (value: string) => {
  if (!DATE_KEY_PATTERN.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const dateKeyFromParts = (parts: Intl.DateTimeFormatPart[]) => {
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  const value = `${values.year}-${values.month}-${values.day}`;
  return isValidDateKey(value) ? value : "";
};

export const homeDateKey = (value: Date, timeZone = HOME_TIME_ZONE) => {
  if (Number.isNaN(value.getTime())) return "";
  return dateKeyFromParts(datePartsFormatter(timeZone).formatToParts(value));
};

export const homeTodayKey = (now = new Date(), timeZone = HOME_TIME_ZONE) => homeDateKey(now, timeZone);

const rowText = (row: Row, propertyId: string) => valueText(getValue(row, propertyId)).trim();

export const taskIsDone = (row: Row) => ["done", "completed", "complete"].includes(
  rowText(row, GOOGLE_TASK_PROPERTY_IDS.status).toLowerCase(),
);

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
  const open = rows.filter((row) => !taskIsDone(row));
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

const rowStatus = (row: Row) => rowText(row, GOOGLE_CALENDAR_PROPERTY_IDS.status).toLowerCase();

export const calendarEventIsCancelled = (row: Row) => {
  const status = rowStatus(row);
  return status === "cancelled" || status === "canceled";
};

const dateOnly = (value: string) => {
  const result = value.trim().slice(0, 10);
  return isValidDateKey(result) ? result : "";
};

const parseEventDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const timeKey = (date: Date, timeZone: string) => {
  const parts = Object.fromEntries(timePartsFormatter(timeZone).formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${parts.hour || "00"}:${parts.minute || "00"}:${parts.second || "00"}`;
};

const nextDateKey = (value: string) => {
  if (!isValidDateKey(value)) return "";
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
};

export type HomeCalendarEvent = {
  row: Row;
  allDay: boolean;
  start: Date | null;
  end: Date | null;
  startDateKey: string;
  endDateKey: string;
  unknownEnd: boolean;
};

export const calendarEvent = (row: Row, timeZone = HOME_TIME_ZONE): HomeCalendarEvent | null => {
  if (calendarEventIsCancelled(row)) return null;
  const allDayValue = getValue(row, GOOGLE_CALENDAR_PROPERTY_IDS.allDay);
  const allDay = allDayValue === true || String(allDayValue).trim().toLowerCase() === "true";
  const startValue = rowText(row, GOOGLE_CALENDAR_PROPERTY_IDS.start);
  const endValue = rowText(row, GOOGLE_CALENDAR_PROPERTY_IDS.end);
  if (allDay) {
    const startDateKey = dateOnly(startValue);
    if (!startDateKey) return null;
    const parsedEnd = dateOnly(endValue);
    const endDateKey = parsedEnd && parsedEnd > startDateKey ? parsedEnd : nextDateKey(startDateKey);
    return { row, allDay, start: null, end: null, startDateKey, endDateKey, unknownEnd: !parsedEnd || parsedEnd <= startDateKey };
  }
  const start = parseEventDate(startValue);
  if (!start) return null;
  const end = endValue ? parseEventDate(endValue) : null;
  const startDateKey = homeDateKey(start, timeZone);
  const endDateKey = end ? homeDateKey(end, timeZone) : startDateKey;
  return {
    row,
    allDay,
    start,
    end,
    startDateKey,
    endDateKey,
    unknownEnd: !end,
  };
};

const eventOverlapsDate = (event: HomeCalendarEvent, dayKey: string, timeZone: string) => {
  if (!event.startDateKey || !dayKey) return false;
  if (event.allDay) return event.startDateKey <= dayKey && event.endDateKey > dayKey;
  if (!event.start) return false;
  if (!event.end) return event.startDateKey === dayKey;
  if (event.startDateKey === dayKey) return event.start.getTime() < event.end.getTime();
  if (event.startDateKey > dayKey) return false;
  if (event.endDateKey > dayKey) return true;
  if (event.endDateKey < dayKey) return false;
  // The end date is the selected day. An event ending at local midnight ended
  // before that day began; any later local time overlaps the day.
  return timeKey(event.end, timeZone) !== "00:00:00";
};

export const selectCalendarEventsForDay = (rows: Row[], dayKey: string, timeZone = HOME_TIME_ZONE) => rows
  .map((row) => calendarEvent(row, timeZone))
  .filter((event): event is HomeCalendarEvent => {
    if (!event) return false;
    return eventOverlapsDate(event, dayKey, timeZone);
  })
  .sort((first, second) => {
    if (first.allDay !== second.allDay) return first.allDay ? -1 : 1;
    if (first.allDay) return first.startDateKey.localeCompare(second.startDateKey) || compareRows(first.row, second.row);
    return (first.start?.getTime() || 0) - (second.start?.getTime() || 0) || compareRows(first.row, second.row);
  });

export type HomeCalendarSelection = {
  today: HomeCalendarEvent[];
  current: HomeCalendarEvent | null;
  next: HomeCalendarEvent | null;
  todayKey: string;
};

export const selectHomeCalendar = (rows: Row[], now = new Date(), timeZone = HOME_TIME_ZONE): HomeCalendarSelection => {
  const todayKey = homeTodayKey(now, timeZone);
  const today = selectCalendarEventsForDay(rows, todayKey, timeZone);
  const timed = rows
    .map((row) => calendarEvent(row, timeZone))
    .filter((event): event is HomeCalendarEvent => Boolean(event?.start));
  const current = timed
    .filter((event) => {
      const start = event.start;
      const end = event.end;
      return Boolean(start && end && start <= now && now < end);
    })
    .sort((first, second) => (first.end?.getTime() || 0) - (second.end?.getTime() || 0))[0] || null;
  const next = timed
    .filter((event) => event.start && event.start > now)
    .sort((first, second) => (first.start?.getTime() || 0) - (second.start?.getTime() || 0))[0] || null;
  return { today, current, next, todayKey };
};

export const taskDueKey = (row: Row) => validDueKey(row);
export const calendarRowText = rowText;
