import { GOOGLE_CALENDAR_DATABASE_ID, GOOGLE_TASKS_DATABASE_ID } from "../app/personal-space/model.ts";
import { selectHomeCalendar } from "../app/personal-space/calendar-model.ts";
import { selectHomeTasks } from "../app/personal-space/home-model.ts";
import type { Database, Item } from "../app/personal-space/types.ts";

const database = (items: Item[], id: string) => items.find((item): item is Database => item.kind === "database" && item.id === id);
const time = (date: Date) => new Intl.DateTimeFormat("nl-NL", { timeZone: "Europe/Amsterdam", hour: "2-digit", minute: "2-digit" }).format(date);

export type DaySummary = {
  events: { id: string; label: string }[];
  tasks: { id: string; label: string }[];
  /** Tasks due today or overdue; shown next to the menu bar icon. */
  dueCount: number;
};

/** What matters today, read from the synced Google Calendar and Tasks databases. */
export const summarizeDay = (items: Item[], now = new Date()): DaySummary => {
  const calendar = database(items, GOOGLE_CALENDAR_DATABASE_ID);
  const tasks = database(items, GOOGLE_TASKS_DATABASE_ID);
  const events = calendar ? selectHomeCalendar(calendar.rows.filter((row) => !row.trash), now).today : [];
  const selection = tasks ? selectHomeTasks(tasks.rows, now) : null;
  const due = selection ? [...selection.overdue, ...selection.today] : [];
  return {
    events: events.map((event) => ({ id: event.row.id, label: `${event.start ? time(event.start) : "Hele dag"}  ${event.row.title}` })),
    tasks: due.map((row) => ({ id: row.id, label: row.title })),
    dueCount: due.length,
  };
};

/** Events that start within the next `leadMinutes` and have not been announced yet. */
export const upcomingEvents = (items: Item[], now: Date, leadMinutes: number, announced: Set<string>) => {
  const calendar = database(items, GOOGLE_CALENDAR_DATABASE_ID);
  if (!calendar) return [];
  const { today } = selectHomeCalendar(calendar.rows.filter((row) => !row.trash), now);
  const limit = now.getTime() + leadMinutes * 60_000;
  const soon = today.filter((event) => event.start && event.start.getTime() > now.getTime() && event.start.getTime() <= limit && !announced.has(event.row.id));
  for (const event of soon) announced.add(event.row.id);
  return soon.map((event) => ({ id: event.row.id, title: event.row.title, time: time(event.start as Date) }));
};
