import { getValue, GOOGLE_CALENDAR_PROPERTY_IDS, valueText } from "./model.ts";
import type { Row } from "./types.ts";

export const CALENDAR_TIME_ZONE = "Europe/Amsterdam";

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const formatterCache = new Map<string, Intl.DateTimeFormat>();

const datePartsFormatter = (timeZone: string) => {
  const key = `date:${timeZone}`;
  const existing = formatterCache.get(key);
  if (existing) return existing;
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  formatterCache.set(key, formatter);
  return formatter;
};

const timePartsFormatter = (timeZone: string) => {
  const key = `time:${timeZone}`;
  const existing = formatterCache.get(key);
  if (existing) return existing;
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  formatterCache.set(key, formatter);
  return formatter;
};

const partsValue = (parts: Intl.DateTimeFormatPart[]) => Object.fromEntries(
  parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]),
);

export const isCalendarDateKey = (value: string) => {
  if (!DATE_KEY_PATTERN.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

export const calendarDateKey = (date: Date, timeZone = CALENDAR_TIME_ZONE) => {
  if (Number.isNaN(date.getTime())) return "";
  const values = partsValue(datePartsFormatter(timeZone).formatToParts(date));
  const key = `${values.year}-${values.month}-${values.day}`;
  return isCalendarDateKey(key) ? key : "";
};

export const calendarTodayKey = (now = new Date(), timeZone = CALENDAR_TIME_ZONE) => calendarDateKey(now, timeZone);

/** Date-key arithmetic uses calendar dates at UTC noon, never 24-hour local milliseconds. */
export const addCalendarDays = (dateKey: string, amount: number) => {
  if (!isCalendarDateKey(dateKey) || !Number.isInteger(amount)) return "";
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
};

export const calendarMonthKey = (dateKey: string) => isCalendarDateKey(dateKey) ? dateKey.slice(0, 7) : "";

export const calendarMonthStart = (monthKey: string) => /^\d{4}-\d{2}$/.test(monthKey) ? `${monthKey}-01` : "";

export const addCalendarMonths = (monthKey: string, amount: number) => {
  const start = calendarMonthStart(monthKey);
  if (!start || !Number.isInteger(amount)) return "";
  const date = new Date(`${start}T12:00:00Z`);
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + amount);
  return date.toISOString().slice(0, 7);
};

export const startOfCalendarWeek = (dateKey: string) => {
  if (!isCalendarDateKey(dateKey)) return "";
  const date = new Date(`${dateKey}T12:00:00Z`);
  const mondayOffset = (date.getUTCDay() + 6) % 7;
  return addCalendarDays(dateKey, -mondayOffset);
};

export const calendarDaysFrom = (startKey: string, count: number) => {
  if (!isCalendarDateKey(startKey) || !Number.isInteger(count) || count < 0) return [];
  return Array.from({ length: count }, (_, index) => addCalendarDays(startKey, index));
};

const rowText = (row: Row, propertyId: string) => valueText(getValue(row, propertyId)).trim();

export const calendarEventIsCancelled = (row: Row) => {
  if (row.trash) return true;
  const status = rowText(row, GOOGLE_CALENDAR_PROPERTY_IDS.status).toLowerCase();
  return status === "cancelled" || status === "canceled";
};

const validDateOnly = (value: string) => {
  const result = value.trim().slice(0, 10);
  return isCalendarDateKey(result) ? result : "";
};

const parseDateTime = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export type CalendarEvent = {
  row: Row;
  allDay: boolean;
  start: Date | null;
  end: Date | null;
  startDateKey: string;
  endDateKey: string;
  unknownEnd: boolean;
};

export const parseCalendarEvent = (row: Row, timeZone = CALENDAR_TIME_ZONE): CalendarEvent | null => {
  if (calendarEventIsCancelled(row)) return null;
  const allDayValue = getValue(row, GOOGLE_CALENDAR_PROPERTY_IDS.allDay);
  const startValue = rowText(row, GOOGLE_CALENDAR_PROPERTY_IDS.start);
  const endValue = rowText(row, GOOGLE_CALENDAR_PROPERTY_IDS.end);
  const allDay = allDayValue === true || String(allDayValue).trim().toLowerCase() === "true" || !startValue.includes("T");

  if (allDay) {
    const startDateKey = validDateOnly(startValue);
    if (!startDateKey) return null;
    const parsedEnd = validDateOnly(endValue);
    const endDateKey = parsedEnd && parsedEnd > startDateKey ? parsedEnd : addCalendarDays(startDateKey, 1);
    return { row, allDay: true, start: null, end: null, startDateKey, endDateKey, unknownEnd: !parsedEnd || parsedEnd <= startDateKey };
  }

  const start = parseDateTime(startValue);
  if (!start) return null;
  const parsedEnd = endValue ? parseDateTime(endValue) : null;
  const end = parsedEnd && parsedEnd.getTime() > start.getTime() ? parsedEnd : null;
  const startDateKey = calendarDateKey(start, timeZone);
  if (!startDateKey) return null;
  const endDateKey = end ? calendarDateKey(end, timeZone) : startDateKey;
  return { row, allDay: false, start, end, startDateKey, endDateKey: endDateKey || startDateKey, unknownEnd: !end };
};

const localTimeKey = (date: Date, timeZone: string) => {
  const values = partsValue(timePartsFormatter(timeZone).formatToParts(date));
  return `${values.hour || "00"}:${values.minute || "00"}:${values.second || "00"}`;
};

export const calendarEventOverlapsDay = (event: CalendarEvent, dayKey: string, timeZone = CALENDAR_TIME_ZONE) => {
  if (!isCalendarDateKey(dayKey) || !event.startDateKey) return false;
  if (event.allDay) return event.startDateKey <= dayKey && event.endDateKey > dayKey;
  if (!event.start) return false;
  if (!event.end) return event.startDateKey === dayKey;
  if (event.startDateKey === dayKey) return event.start.getTime() < event.end.getTime();
  if (event.startDateKey > dayKey || event.endDateKey < dayKey) return false;
  if (event.endDateKey > dayKey) return true;
  return localTimeKey(event.end, timeZone) !== "00:00:00";
};

const compareEvents = (first: CalendarEvent, second: CalendarEvent) => {
  if (first.allDay !== second.allDay) return first.allDay ? -1 : 1;
  const firstTime = first.start?.getTime() || 0;
  const secondTime = second.start?.getTime() || 0;
  return firstTime - secondTime || first.row.title.localeCompare(second.row.title, undefined, { sensitivity: "base" }) || first.row.id.localeCompare(second.row.id);
};

export const parseCalendarEvents = (rows: Row[], timeZone = CALENDAR_TIME_ZONE) => rows
  .map((row) => parseCalendarEvent(row, timeZone))
  .filter((event): event is CalendarEvent => Boolean(event));

export const selectParsedCalendarEventsForVisibleDays = (parsed: CalendarEvent[], dayKeys: string[], timeZone = CALENDAR_TIME_ZONE) => {
  const grouped = new Map<string, CalendarEvent[]>();
  const visibleDays = [...new Set(dayKeys.filter(isCalendarDateKey))];
  visibleDays.forEach((dayKey) => grouped.set(dayKey, parsed.filter((event) => calendarEventOverlapsDay(event, dayKey, timeZone)).sort(compareEvents)));
  return grouped;
};

export const selectParsedCalendarEventsForDay = (parsed: CalendarEvent[], dayKey: string, timeZone = CALENDAR_TIME_ZONE) => selectParsedCalendarEventsForVisibleDays(parsed, [dayKey], timeZone).get(dayKey) || [];

export const selectCalendarEventsForVisibleDays = (rows: Row[], dayKeys: string[], timeZone = CALENDAR_TIME_ZONE) => selectParsedCalendarEventsForVisibleDays(parseCalendarEvents(rows, timeZone), dayKeys, timeZone);

export const selectCalendarEventsForDay = (rows: Row[], dayKey: string, timeZone = CALENDAR_TIME_ZONE) => selectCalendarEventsForVisibleDays(rows, [dayKey], timeZone).get(dayKey) || [];

export const selectCalendarEventsForRange = (rows: Row[], startKey: string, endExclusiveKey: string, timeZone = CALENDAR_TIME_ZONE) => {
  const visibleDays = [];
  let day = startKey;
  while (day && day < endExclusiveKey && visibleDays.length <= 366) {
    visibleDays.push(day);
    day = addCalendarDays(day, 1);
  }
  return selectCalendarEventsForVisibleDays(rows, visibleDays, timeZone);
};

export const compareCalendarEvents = compareEvents;

export const calendarEventTimeKey = (event: CalendarEvent, timeZone = CALENDAR_TIME_ZONE) => event.start ? localTimeKey(event.start, timeZone) : "";

export type CalendarSelection = {
  today: CalendarEvent[];
  current: CalendarEvent | null;
  next: CalendarEvent | null;
  todayKey: string;
};

export const selectHomeCalendar = (rows: Row[], now = new Date(), timeZone = CALENDAR_TIME_ZONE): CalendarSelection => {
  const todayKey = calendarTodayKey(now, timeZone);
  const parsed = parseCalendarEvents(rows, timeZone);
  const today = selectParsedCalendarEventsForDay(parsed, todayKey, timeZone);
  const timed = parsed.filter((event) => Boolean(event.start));
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
