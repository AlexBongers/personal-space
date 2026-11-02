"use client";

import { useEffect, useState } from "react";

export type WritableCalendar = { id: string; title: string; primary: boolean };

/** The Google calendars this account can write to, for the calendar choice in the appointment editors. */
export function useWritableCalendars() {
  const [calendars, setCalendars] = useState<WritableCalendar[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let active = true;
    fetch("/api/google-calendar/status", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json() as { calendars?: unknown };
        if (!response.ok || !Array.isArray(body.calendars)) throw new Error("calendar-options-unavailable");
        const next = body.calendars
          .filter((entry): entry is { id: string; title: string; primary?: boolean } => typeof entry === "object" && entry !== null && typeof entry.id === "string" && typeof entry.title === "string")
          .map((calendar) => ({ id: calendar.id, title: calendar.title, primary: Boolean(calendar.primary) }));
        if (active) { setCalendars(next); setState("ready"); }
      })
      .catch(() => { if (active) setState("error"); });
    return () => { active = false; };
  }, []);

  return { calendars, state };
}
