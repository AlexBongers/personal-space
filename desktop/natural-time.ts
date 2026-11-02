const WEEKDAYS = ["zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"];
const MONTHS = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];
const DEFAULT_HOUR = 9;

const UNIT_MINUTES: Record<string, number> = { min: 1, minuut: 1, minuten: 1, kwartier: 15, uur: 60, uren: 60, dag: 1440, dagen: 1440, week: 10080, weken: 10080 };

export type ParsedReminder = { text: string; at: Date };

const atDay = (base: Date, days: number, hour: number, minute: number) =>
  new Date(base.getFullYear(), base.getMonth(), base.getDate() + days, hour, minute);

/**
 * Reads a Dutch time phrase from a reminder, such as "morgen 9:00 tandarts bellen", "over 20 min thee",
 * "vrijdag 14.30 rapport", "om 16:00 ophalen" or "12-6 verjaardag". Uses the computer's time zone.
 * Returns null when there is no time in the text.
 */
export const parseReminder = (input: string, now = new Date()): ParsedReminder | null => {
  let text = ` ${input.trim()} `;
  const take = (pattern: RegExp) => {
    const match = text.match(pattern);
    if (match) text = text.replace(match[0], " ");
    return match;
  };

  const relative = take(/\s(?:over|binnen)\s+(een|half|\d+)\s*(min|minuut|minuten|kwartier|uur|uren|dag|dagen|week|weken)\b/i);
  if (relative) {
    const amount = relative[1] === "een" ? 1 : relative[1] === "half" ? 0.5 : Number(relative[1]);
    return finish(text, new Date(now.getTime() + amount * UNIT_MINUTES[relative[2].toLowerCase()] * 60_000));
  }

  const time = take(/\s(?:om\s+)?(\d{1,2})[:.](\d{2})(?:\s*uur)?\b/i) ?? take(/\som\s+(\d{1,2})(?:\s*uur)?\b/i) ?? take(/\s(\d{1,2})\s*uur\b/i);
  const hour = time ? Number(time[1]) : DEFAULT_HOUR;
  const minute = time && time[2] ? Number(time[2]) : 0;
  if (hour > 23 || minute > 59) return null;

  const word = take(/\s(vandaag|vanavond|morgen|overmorgen)\b/i)?.[1].toLowerCase();
  const weekday = word ? null : take(new RegExp(`\\s(?:op\\s+|volgende\\s+)?(${WEEKDAYS.join("|")})\\b`, "i"))?.[1].toLowerCase();
  const numeric = word || weekday ? null : take(/\s(?:op\s+)?(\d{1,2})[-/](\d{1,2})(?:[-/](\d{4}))?\b/);
  const named = word || weekday || numeric ? null : take(new RegExp(`\\s(?:op\\s+)?(\\d{1,2})\\s+(${MONTHS.join("|")})(?:\\s+(\\d{4}))?\\b`, "i"));

  if (word) {
    const days = { vandaag: 0, vanavond: 0, morgen: 1, overmorgen: 2 }[word] ?? 0;
    const eveningHour = word === "vanavond" && !time ? 20 : hour;
    return finish(text, atDay(now, days, eveningHour, minute));
  }
  if (weekday) {
    let days = (WEEKDAYS.indexOf(weekday) - now.getDay() + 7) % 7;
    if (days === 0 && atDay(now, 0, hour, minute) <= now) days = 7;
    return finish(text, atDay(now, days, hour, minute));
  }
  const dated = numeric
    ? { day: Number(numeric[1]), month: Number(numeric[2]) - 1, year: numeric[3] ? Number(numeric[3]) : null }
    : named ? { day: Number(named[1]), month: MONTHS.indexOf(named[2].toLowerCase()), year: named[3] ? Number(named[3]) : null } : null;
  if (dated) {
    let at = new Date(dated.year ?? now.getFullYear(), dated.month, dated.day, hour, minute);
    if (at.getMonth() !== dated.month) return null;
    if (dated.year === null && at <= now) at = new Date(now.getFullYear() + 1, dated.month, dated.day, hour, minute);
    return finish(text, at);
  }
  if (time) {
    const today = atDay(now, 0, hour, minute);
    return finish(text, today > now ? today : atDay(now, 1, hour, minute));
  }
  return null;
};

const finish = (text: string, at: Date): ParsedReminder | null => {
  const cleaned = text.replace(/\s+/g, " ").trim().replace(/^(aan|om|op|dat|:|-)\s+/i, "").trim();
  return cleaned ? { text: cleaned.charAt(0).toUpperCase() + cleaned.slice(1), at } : null;
};
