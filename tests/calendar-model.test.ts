import assert from "node:assert/strict";
import test from "node:test";
import {
  addCalendarDays,
  addCalendarMonths,
  calendarDateKey,
  calendarDaysFrom,
  parseCalendarEvent,
  selectCalendarEventsForDay,
  selectCalendarEventsForVisibleDays,
  startOfCalendarWeek,
} from "../app/personal-space/calendar-model.ts";
import { GOOGLE_CALENDAR_PROPERTY_IDS } from "../app/personal-space/model.ts";
import type { Row } from "../app/personal-space/types.ts";

const event = (id: string, title: string, values: Record<string, string | boolean>): Row => ({ id, title, values, blocks: [] });

test("all-day calendar intervals include the start and exclude the end", () => {
  const row = event("holiday", "Holiday", {
    [GOOGLE_CALENDAR_PROPERTY_IDS.start]: "2026-10-19",
    [GOOGLE_CALENDAR_PROPERTY_IDS.end]: "2026-10-24",
    [GOOGLE_CALENDAR_PROPERTY_IDS.allDay]: true,
  });
  assert.deepEqual(
    ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23"].map((day) => selectCalendarEventsForDay([row], day).map((entry) => entry.row.id)),
    [["holiday"], ["holiday"], ["holiday"], ["holiday"], ["holiday"]],
  );
  assert.deepEqual(selectCalendarEventsForDay([row], "2026-10-24"), []);
  assert.equal(parseCalendarEvent(row)?.endDateKey, "2026-10-24");
});

test("timed events overlap both local days but an event ending at midnight does not continue", () => {
  const overnight = event("overnight", "Overnight", {
    [GOOGLE_CALENDAR_PROPERTY_IDS.start]: "2026-03-28T23:30:00+01:00",
    [GOOGLE_CALENDAR_PROPERTY_IDS.end]: "2026-03-29T02:30:00+02:00",
    [GOOGLE_CALENDAR_PROPERTY_IDS.allDay]: false,
  });
  const midnight = event("midnight", "Ends at midnight", {
    [GOOGLE_CALENDAR_PROPERTY_IDS.start]: "2026-03-28T23:00:00+01:00",
    [GOOGLE_CALENDAR_PROPERTY_IDS.end]: "2026-03-29T00:00:00+01:00",
    [GOOGLE_CALENDAR_PROPERTY_IDS.allDay]: false,
  });
  assert.deepEqual(selectCalendarEventsForDay([overnight, midnight], "2026-03-28").map((entry) => entry.row.id), ["midnight", "overnight"]);
  assert.deepEqual(selectCalendarEventsForDay([overnight, midnight], "2026-03-29").map((entry) => entry.row.id), ["overnight"]);
});

test("calendar date keys and week navigation use calendar dates across DST and year boundaries", () => {
  assert.equal(calendarDateKey(new Date("2026-03-29T00:30:00Z")), "2026-03-29");
  assert.equal(calendarDateKey(new Date("2026-10-25T00:30:00Z")), "2026-10-25");
  assert.equal(startOfCalendarWeek("2026-01-01"), "2025-12-29");
  assert.deepEqual(calendarDaysFrom("2025-12-29", 7), ["2025-12-29", "2025-12-30", "2025-12-31", "2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04"]);
  assert.equal(addCalendarDays("2026-03-28", 2), "2026-03-30");
  assert.equal(addCalendarMonths("2025-12", 1), "2026-01");
});

test("invalid or missing end keeps only the valid start day, without inventing a duration", () => {
  const rows = [
    event("missing", "Missing end", {
      [GOOGLE_CALENDAR_PROPERTY_IDS.start]: "2026-09-06T10:00:00+02:00",
      [GOOGLE_CALENDAR_PROPERTY_IDS.end]: "",
      [GOOGLE_CALENDAR_PROPERTY_IDS.allDay]: false,
    }),
    event("invalid", "Invalid end", {
      [GOOGLE_CALENDAR_PROPERTY_IDS.start]: "2026-09-06T11:00:00+02:00",
      [GOOGLE_CALENDAR_PROPERTY_IDS.end]: "not-a-date",
      [GOOGLE_CALENDAR_PROPERTY_IDS.allDay]: false,
    }),
    event("bad-start", "Bad start", {
      [GOOGLE_CALENDAR_PROPERTY_IDS.start]: "not-a-date",
      [GOOGLE_CALENDAR_PROPERTY_IDS.end]: "2026-09-06T12:00:00+02:00",
      [GOOGLE_CALENDAR_PROPERTY_IDS.allDay]: false,
    }),
  ];
  assert.deepEqual(selectCalendarEventsForDay(rows, "2026-09-06").map((entry) => entry.row.id), ["missing", "invalid"]);
  assert.equal(parseCalendarEvent(rows[0])?.unknownEnd, true);
  assert.deepEqual(selectCalendarEventsForVisibleDays(rows, ["2026-09-07"]).get("2026-09-07"), []);
});

test("cancelled events are excluded and visible grouping does not expand long ranges", () => {
  const cancelled = event("cancelled", "Cancelled", {
    [GOOGLE_CALENDAR_PROPERTY_IDS.status]: "Cancelled",
    [GOOGLE_CALENDAR_PROPERTY_IDS.start]: "2026-09-06",
    [GOOGLE_CALENDAR_PROPERTY_IDS.end]: "2026-09-07",
    [GOOGLE_CALENDAR_PROPERTY_IDS.allDay]: true,
  });
  const long = event("long", "Long event", {
    [GOOGLE_CALENDAR_PROPERTY_IDS.start]: "2020-01-01",
    [GOOGLE_CALENDAR_PROPERTY_IDS.end]: "2030-01-01",
    [GOOGLE_CALENDAR_PROPERTY_IDS.allDay]: true,
  });
  const grouped = selectCalendarEventsForVisibleDays([cancelled, long], ["2026-09-06", "2026-09-07"]);
  assert.deepEqual([...grouped.keys()], ["2026-09-06", "2026-09-07"]);
  assert.deepEqual(grouped.get("2026-09-06")?.map((entry) => entry.row.id), ["long"]);
  assert.deepEqual(grouped.get("2026-09-07")?.map((entry) => entry.row.id), ["long"]);
});
