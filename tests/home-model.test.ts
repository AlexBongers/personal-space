import assert from "node:assert/strict";
import test from "node:test";
import {
  HOME_TIME_ZONE,
  selectCalendarEventsForDay,
  selectHomeCalendar,
  selectHomeTasks,
} from "../app/personal-space/home-model.ts";
import {
  GOOGLE_CALENDAR_PROPERTY_IDS,
  GOOGLE_TASK_PROPERTY_IDS,
} from "../app/personal-space/model.ts";
import type { Row } from "../app/personal-space/types.ts";

const task = (id: string, title: string, due: string, status = "Open"): Row => ({
  id,
  title,
  values: {
    [GOOGLE_TASK_PROPERTY_IDS.status]: status,
    [GOOGLE_TASK_PROPERTY_IDS.due]: due,
  },
  blocks: [],
});

const event = (id: string, title: string, values: Record<string, string | boolean>): Row => ({
  id,
  title,
  values,
  blocks: [],
});

test("home task selectors keep today's work separate from overdue and undated rows", () => {
  const selected = selectHomeTasks([
    task("today", "Today", "2026-09-06"),
    task("old", "Old", "2026-09-01"),
    task("done", "Done", "2026-09-06", "Done"),
    task("future", "Future", "2026-09-10"),
    task("undated", "Undated", ""),
    task("invalid", "Invalid", "not-a-date"),
  ], new Date("2026-09-06T10:00:00+02:00"));

  assert.equal(HOME_TIME_ZONE, "Europe/Amsterdam");
  assert.deepEqual(selected.today.map((row) => row.id), ["today"]);
  assert.deepEqual(selected.overdue.map((row) => row.id), ["old"]);
  assert.deepEqual(selected.future.map((row) => row.id), ["future"]);
  assert.deepEqual(selected.undated.map((row) => row.id), ["invalid", "undated"]);
  assert.deepEqual(selected.open.map((row) => row.id).sort(), ["future", "invalid", "old", "today", "undated"]);
});

test("calendar selectors apply Amsterdam offsets and all-day exclusive ends", () => {
  const rows = [
    event("overnight", "Overnight", {
      [GOOGLE_CALENDAR_PROPERTY_IDS.start]: "2026-09-05T23:30:00+02:00",
      [GOOGLE_CALENDAR_PROPERTY_IDS.end]: "2026-09-06T02:30:00+02:00",
      [GOOGLE_CALENDAR_PROPERTY_IDS.allDay]: false,
    }),
    event("all-day", "Two days", {
      [GOOGLE_CALENDAR_PROPERTY_IDS.start]: "2026-09-05",
      [GOOGLE_CALENDAR_PROPERTY_IDS.end]: "2026-09-07",
      [GOOGLE_CALENDAR_PROPERTY_IDS.allDay]: true,
    }),
    event("ends-midnight", "Ends at midnight", {
      [GOOGLE_CALENDAR_PROPERTY_IDS.start]: "2026-09-05T22:00:00+02:00",
      [GOOGLE_CALENDAR_PROPERTY_IDS.end]: "2026-09-06T00:00:00+02:00",
      [GOOGLE_CALENDAR_PROPERTY_IDS.allDay]: false,
    }),
    event("cancelled", "Cancelled", {
      [GOOGLE_CALENDAR_PROPERTY_IDS.status]: "Cancelled",
      [GOOGLE_CALENDAR_PROPERTY_IDS.start]: "2026-09-06T12:00:00+02:00",
      [GOOGLE_CALENDAR_PROPERTY_IDS.end]: "2026-09-06T13:00:00+02:00",
      [GOOGLE_CALENDAR_PROPERTY_IDS.allDay]: false,
    }),
    event("bad", "Bad date", {
      [GOOGLE_CALENDAR_PROPERTY_IDS.start]: "not-a-date",
      [GOOGLE_CALENDAR_PROPERTY_IDS.end]: "2026-09-06T13:00:00+02:00",
      [GOOGLE_CALENDAR_PROPERTY_IDS.allDay]: false,
    }),
  ];

  assert.deepEqual(selectCalendarEventsForDay(rows, "2026-09-06").map((entry) => entry.row.id), ["all-day", "overnight"]);
  assert.deepEqual(selectCalendarEventsForDay(rows, "2026-09-07").map((entry) => entry.row.id), []);
  assert.equal(selectCalendarEventsForDay([
    event("unknown-end", "Unknown end", {
      [GOOGLE_CALENDAR_PROPERTY_IDS.start]: "2026-09-06T14:00:00+02:00",
      [GOOGLE_CALENDAR_PROPERTY_IDS.end]: "",
      [GOOGLE_CALENDAR_PROPERTY_IDS.allDay]: false,
    }),
  ], "2026-09-06").length, 1);
});

test("calendar overview chooses current before the next timed event", () => {
  const rows = [
    event("current", "Current", {
      [GOOGLE_CALENDAR_PROPERTY_IDS.start]: "2026-09-06T09:00:00+02:00",
      [GOOGLE_CALENDAR_PROPERTY_IDS.end]: "2026-09-06T11:00:00+02:00",
      [GOOGLE_CALENDAR_PROPERTY_IDS.allDay]: false,
    }),
    event("next", "Next", {
      [GOOGLE_CALENDAR_PROPERTY_IDS.start]: "2026-09-06T12:00:00+02:00",
      [GOOGLE_CALENDAR_PROPERTY_IDS.end]: "2026-09-06T13:00:00+02:00",
      [GOOGLE_CALENDAR_PROPERTY_IDS.allDay]: false,
    }),
  ];
  const result = selectHomeCalendar(rows, new Date("2026-09-06T10:00:00+02:00"));
  assert.equal(result.current?.row.id, "current");
  assert.equal(result.next?.row.id, "next");
  assert.equal(result.todayKey, "2026-09-06");
});
