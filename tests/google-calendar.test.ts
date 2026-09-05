import test from "node:test";
import assert from "node:assert/strict";
import {
  createGoogleCalendarDatabase,
  GOOGLE_CALENDAR_PROPERTY_IDS,
} from "../app/personal-space/model.ts";
import { googleCalendarPayload, googleCalendarToRow } from "../worker/google-calendar.ts";

test("Google Calendar database exposes editable event fields", () => {
  const database = createGoogleCalendarDatabase();
  assert.equal(database.id, "google-calendar");
  assert.equal(database.view.mode, "list");
  assert.ok(database.properties.some((property) => property.id === GOOGLE_CALENDAR_PROPERTY_IDS.start));
  assert.ok(database.properties.some((property) => property.id === GOOGLE_CALENDAR_PROPERTY_IDS.allDay));
  assert.ok(database.properties.some((property) => property.id === GOOGLE_CALENDAR_PROPERTY_IDS.attendees));
});

test("Google Calendar payload preserves all-day and timed events", () => {
  const allDay = {
    id: "event-1",
    title: "Plan week",
    values: {
      [GOOGLE_CALENDAR_PROPERTY_IDS.start]: "2026-09-04",
      [GOOGLE_CALENDAR_PROPERTY_IDS.end]: "2026-09-05",
      [GOOGLE_CALENDAR_PROPERTY_IDS.allDay]: true,
      [GOOGLE_CALENDAR_PROPERTY_IDS.notes]: "Focus time",
      [GOOGLE_CALENDAR_PROPERTY_IDS.location]: "Home",
      [GOOGLE_CALENDAR_PROPERTY_IDS.attendees]: "laurademooij@gmail.com, second@example.com, laurademooij@gmail.com",
    },
    blocks: [],
  };
  assert.deepEqual(googleCalendarPayload(allDay), {
    summary: "Plan week",
    description: "Focus time",
    location: "Home",
    attendees: [{ email: "laurademooij@gmail.com" }, { email: "second@example.com" }],
    start: { date: "2026-09-04" },
    end: { date: "2026-09-05" },
  });

  const timed = {
    ...allDay,
    values: {
      ...allDay.values,
      [GOOGLE_CALENDAR_PROPERTY_IDS.start]: "2026-09-04T10:30",
      [GOOGLE_CALENDAR_PROPERTY_IDS.end]: "2026-09-04T11:15",
      [GOOGLE_CALENDAR_PROPERTY_IDS.allDay]: false,
    },
  };
  assert.deepEqual(googleCalendarPayload(timed), {
    summary: "Plan week",
    description: "Focus time",
    location: "Home",
    attendees: [{ email: "laurademooij@gmail.com" }, { email: "second@example.com" }],
    start: { dateTime: "2026-09-04T10:30:00Z" },
    end: { dateTime: "2026-09-04T11:15:00Z" },
  });
});

test("Google Calendar event mapping keeps stable identifiers", () => {
  const row = googleCalendarToRow({
    id: "event-1",
    status: "confirmed",
    summary: "Plan week",
    start: { date: "2026-09-04" },
    end: { date: "2026-09-05" },
    htmlLink: "https://calendar.google.com/event-1",
    etag: "etag-1",
    updated: "2026-09-03T10:00:00Z",
    attendees: [{ email: "laurademooij@gmail.com" }],
  }, { id: "primary", summary: "Personal", accessRole: "owner", primary: true });
  assert.equal(row.id, "google-calendar-primary-event-1");
  assert.equal(row.values[GOOGLE_CALENDAR_PROPERTY_IDS.id], "event-1");
  assert.equal(row.values[GOOGLE_CALENDAR_PROPERTY_IDS.calendar], "Personal");
  assert.equal(row.values[GOOGLE_CALENDAR_PROPERTY_IDS.allDay], true);
  assert.equal(row.values[GOOGLE_CALENDAR_PROPERTY_IDS.attendees], "laurademooij@gmail.com");
});
