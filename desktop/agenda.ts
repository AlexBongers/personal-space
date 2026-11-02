import { GOOGLE_CALENDAR_DATABASE_ID, GOOGLE_TASKS_DATABASE_ID } from "../app/personal-space/model.ts";
import { calendarTodayKey, selectHomeCalendar } from "../app/personal-space/calendar-model.ts";
import { selectHomeTasks } from "../app/personal-space/home-model.ts";
import type { Database, Item } from "../app/personal-space/types.ts";

const database = (items: Item[], id: string) => items.find((item): item is Database => item.kind === "database" && item.id === id);
const time = (date: Date) => new Intl.DateTimeFormat("nl-NL", { timeZone: "Europe/Amsterdam", hour: "2-digit", minute: "2-digit" }).format(date);

export type AgendaEvent = { id: string; title: string; label: string; start: number | null };
export type DaySummary = {
  events: AgendaEvent[];
  tasks: { id: string; label: string }[];
  /** Tasks due today or overdue; shown next to the menu bar icon. */
  dueCount: number;
};

/** What matters today, read from the synced Google Calendar and Tasks databases. Only small values are kept. */
export const summarizeDay = (items: Item[], now = new Date()): DaySummary => {
  const calendar = database(items, GOOGLE_CALENDAR_DATABASE_ID);
  const tasks = database(items, GOOGLE_TASKS_DATABASE_ID);
  const events = calendar ? selectHomeCalendar(calendar.rows.filter((row) => !row.trash), now).today : [];
  const selection = tasks ? selectHomeTasks(tasks.rows, now) : null;
  const due = selection ? [...selection.overdue, ...selection.today] : [];
  return {
    events: events.map((event) => ({
      id: event.row.id,
      title: event.row.title,
      label: `${event.start ? time(event.start) : "Hele dag"}  ${event.row.title}`,
      start: event.start ? event.start.getTime() : null,
    })),
    tasks: due.map((row) => ({ id: row.id, label: row.title })),
    dueCount: due.length,
  };
};

/**
 * Keeps today's summary and rebuilds it only when the workspace revision or the date changes,
 * so the minute timer reads one number instead of parsing the whole workspace.
 */
export const createDayCache = (readRevision: () => number, readItems: () => Promise<Item[]>) => {
  let key = "";
  let summary: DaySummary = { events: [], tasks: [], dueCount: 0 };
  return async (now: Date) => {
    const next = `${readRevision()}:${calendarTodayKey(now)}`;
    if (next !== key) {
      summary = summarizeDay(await readItems(), now);
      key = next;
    }
    return summary;
  };
};

/** Announces each event once, shortly before it starts. Forgets yesterday's events so the set never grows. */
export const createEventAnnouncer = () => {
  let day = "";
  const announced = new Set<string>();
  return (summary: DaySummary, now: Date, leadMinutes: number) => {
    const today = calendarTodayKey(now);
    if (today !== day) { announced.clear(); day = today; }
    const limit = now.getTime() + leadMinutes * 60_000;
    const soon = summary.events.filter((event) => event.start !== null && event.start > now.getTime() && event.start <= limit && !announced.has(event.id));
    for (const event of soon) announced.add(event.id);
    return soon.map((event) => ({ id: event.id, title: event.title, time: time(new Date(event.start as number)) }));
  };
};
