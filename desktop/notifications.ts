import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { DaySummary } from "./agenda.ts";

const REMEMBERED = 500;

/** What the app already announced, so every message is announced once, also across restarts. */
export type NotifyState = { seen: Record<string, string[]>; lastBriefing: string };

export const loadNotifyState = (path: string): NotifyState =>
  existsSync(path) ? { seen: {}, lastBriefing: "", ...JSON.parse(readFileSync(path, "utf8")) as Partial<NotifyState> } : { seen: {}, lastBriefing: "" };
export const saveNotifyState = (path: string, state: NotifyState) => writeFileSync(path, `${JSON.stringify(state)}\n`);

/**
 * Returns the unread messages that were not announced before and records them as seen.
 * The first time a source is checked everything is only recorded, so connecting does not flood you.
 */
export const freshMessages = <T extends { id: string; unread: boolean }>(state: NotifyState, source: string, messages: T[]): T[] => {
  const known = state.seen[source];
  const ids = messages.map((message) => message.id);
  state.seen[source] = [...new Set([...ids, ...(known ?? [])])].slice(0, REMEMBERED);
  if (!known) return [];
  return messages.filter((message) => message.unread && !known.includes(message.id));
};

const localDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

/** True once per day from the configured time ("07:30") onwards; an empty time turns the briefing off. */
export const briefingDue = (now: Date, time: string, lastBriefing: string) => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) return false;
  const today = localDate(now);
  return lastBriefing !== today && now.getHours() * 60 + now.getMinutes() >= Number(match[1]) * 60 + Number(match[2]);
};

export const briefingDate = localDate;

const count = (amount: number, one: string, many: string) => `${amount} ${amount === 1 ? one : many}`;

export const briefingText = (day: DaySummary, remindersToday: number) => {
  if (!day.events.length && !day.tasks.length && !remindersToday) return "Niets gepland vandaag. Geniet ervan.";
  const parts = [count(day.events.length, "afspraak", "afspraken"), count(day.dueCount, "taak", "taken"), count(remindersToday, "herinnering", "herinneringen")];
  const first = day.events[0] ? ` Eerste: ${day.events[0].label.replace(/\s+/g, " ")}.` : "";
  return `${parts.join(", ")}.${first}`;
};
