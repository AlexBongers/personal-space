"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  calendarRowText,
  HOME_TIME_ZONE,
  selectHomeCalendar,
  selectHomeTasks,
  taskDueKey,
} from "./home-model";
import {
  getValue,
  GOOGLE_CALENDAR_DATABASE_ID,
  GOOGLE_CALENDAR_PROPERTY_IDS,
  GOOGLE_TASKS_DATABASE_ID,
  GOOGLE_TASK_PROPERTY_IDS,
  isDatabase,
  valueText,
} from "./model";
import { useLanguage } from "./i18n";
import { SlashdotFeed, type NewsSource } from "./SlashdotFeed";
import { GmailInbox } from "./GmailInbox";
import { ParroInbox } from "./ParroInbox";
import { InterfaceIcon } from "./InterfaceIcon";
import { activeRows } from "./workspace-trash.ts";
import { taskReminder } from "./editor-model.ts";
import { addCalendarDays, calendarTodayKey, parseCalendarEvents, selectParsedCalendarEventsForDay, type CalendarEvent } from "./calendar-model.ts";
import type { Item } from "./types";

export type HomeQuickAddKind = "task" | "note";

type HomeOverviewProps = {
  items: Item[];
  onOpen: (id: string, rowId?: string) => void;
  /** The page/controller owns mutation and persistence. Home only emits intent. */
  onQuickAdd?: (kind: HomeQuickAddKind, text: string) => boolean | void;
  quickAddDisabled?: boolean;
  quickAddStatus?: string;
};

const NEWS_PREFERENCE_KEY = "personal-space-home-news-v1";
const NEWS_PREFERENCE_VERSION = 1 as const;
const NEWS_SOURCES: Array<{ source: NewsSource; label: string }> = [
  { source: "slashdot", label: "Slashdot" },
  { source: "tweakers", label: "Tweakers" },
  { source: "nos", label: "NOS" },
  { source: "bunniksnieuws", label: "Bunniks Nieuws" },
];

type NewsPreferences = {
  version: typeof NEWS_PREFERENCE_VERSION;
  order: NewsSource[];
  collapsed: Partial<Record<NewsSource, boolean>>;
  /** The source shown in the news block. */
  active?: NewsSource;
};

const defaultNewsPreferences = (): NewsPreferences => ({
  version: NEWS_PREFERENCE_VERSION,
  order: NEWS_SOURCES.map(({ source }) => source),
  collapsed: {},
});

const validNewsSource = (value: unknown): value is NewsSource => NEWS_SOURCES.some(({ source }) => source === value);

const readNewsPreferences = (): NewsPreferences => {
  const fallback = defaultNewsPreferences();
  try {
    const raw = window.localStorage.getItem(NEWS_PREFERENCE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<NewsPreferences>;
    if (!parsed || parsed.version !== NEWS_PREFERENCE_VERSION) return fallback;
    const order = Array.isArray(parsed.order) ? [...new Set(parsed.order.filter(validNewsSource))] : [];
    const completeOrder = [...order, ...fallback.order.filter((source) => !order.includes(source))];
    const collapsed = parsed.collapsed && typeof parsed.collapsed === "object"
      ? Object.fromEntries(Object.entries(parsed.collapsed).filter(([source, value]) => validNewsSource(source) && typeof value === "boolean")) as NewsPreferences["collapsed"]
      : {};
    return { version: NEWS_PREFERENCE_VERSION, order: completeOrder, collapsed, active: validNewsSource(parsed.active) ? parsed.active : undefined };
  } catch {
    return fallback;
  }
};

const saveNewsPreferences = (preferences: NewsPreferences) => {
  try {
    window.localStorage.setItem(NEWS_PREFERENCE_KEY, JSON.stringify(preferences));
  } catch {
    // Device preferences are optional; a blocked storage must not break Home.
  }
};

const formatDate = (date: Date, language: "en" | "nl") => new Intl.DateTimeFormat(language === "nl" ? "nl-NL" : "en-US", {
  timeZone: HOME_TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
}).format(date);

const formatTime = (date: Date, language: "en" | "nl") => new Intl.DateTimeFormat(language === "nl" ? "nl-NL" : "en-US", {
  timeZone: HOME_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
}).format(date);

const formatDueDate = (value: string, language: "en" | "nl") => {
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(language === "nl" ? "nl-NL" : "en-US", { day: "numeric", month: "short" }).format(date);
};

const hourIn = (date: Date) => Number(new Intl.DateTimeFormat("en-GB", { timeZone: HOME_TIME_ZONE, hour: "2-digit", hourCycle: "h23" }).format(date));

const MAX_ROWS = 6;
const PANELS_KEY = "personal-space-home-panels";
type PanelId = "today" | "tasks" | "inbox" | "news";
type PanelState = { open: boolean; onToggle: () => void };

/** A Home block that folds open and closed from its heading. */
function Panel({ title, icon, open, onToggle, action, className = "", children }: { title: string; icon: Parameters<typeof InterfaceIcon>[0]["name"]; action?: ReactNode; className?: string; children: ReactNode } & PanelState) {
  const { t } = useLanguage();
  return (
    <section className={`home-card home-panel ${open ? "is-open" : "is-folded"} ${className}`}>
      <div className="home-panel-heading">
        <button type="button" className="home-panel-toggle" aria-expanded={open} aria-label={t(open ? "home.collapse" : "home.expand", { title })} onClick={onToggle}>
          <span className="home-panel-chevron" aria-hidden="true">›</span>
          <InterfaceIcon name={icon} />
          <h2>{title}</h2>
        </button>
        {open && action}
      </div>
      {open && <div className="home-panel-body">{children}</div>}
    </section>
  );
}

/** Which Home blocks are folded, remembered on this device. */
function usePanels() {
  const [folded, setFolded] = useState<Partial<Record<PanelId, boolean>>>({});
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try { setFolded(JSON.parse(window.localStorage.getItem(PANELS_KEY) || "{}")); } catch { /* All open by default. */ }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  return (id: PanelId): PanelState => ({
    open: !folded[id],
    onToggle: () => setFolded((current) => {
      const next = { ...current, [id]: !current[id] };
      try { window.localStorage.setItem(PANELS_KEY, JSON.stringify(next)); } catch { /* Lasts for this session. */ }
      return next;
    }),
  });
}

/** Today's and tomorrow's appointments, so the next day is never a surprise. */
function HomeAgenda({ items, now, onOpen, panel }: { items: Item[]; now: Date; onOpen: (id: string, rowId?: string) => void; panel: PanelState }) {
  const { language, t } = useLanguage();
  const calendarDatabase = items.find((item) => item.id === GOOGLE_CALENDAR_DATABASE_ID && !item.trash);
  const rows = useMemo(() => isDatabase(calendarDatabase) ? activeRows(calendarDatabase) : [], [calendarDatabase]);
  const calendar = useMemo(() => selectHomeCalendar(rows, now), [now, rows]);
  const tomorrow = useMemo(() => selectParsedCalendarEventsForDay(parseCalendarEvents(rows), addCalendarDays(calendarTodayKey(now), 1)), [now, rows]);
  const timeOf = (event: CalendarEvent) => {
    if (event.allDay) return t("home.allDay");
    if (!event.start) return "";
    return !event.end || event.unknownEnd ? formatTime(event.start, language) : `${formatTime(event.start, language)}–${formatTime(event.end, language)}`;
  };
  const list = (events: CalendarEvent[], empty: string, withTags: boolean) => events.length ? (
    <ol className="home-rows">
      {events.slice(0, MAX_ROWS).map((event) => {
        const tag = !withTags ? "" : calendar.current?.row.id === event.row.id ? t("home.now") : calendar.next?.row.id === event.row.id ? t("home.next") : "";
        const location = calendarRowText(event.row, GOOGLE_CALENDAR_PROPERTY_IDS.location);
        return (
          <li key={event.row.id}>
            <button type="button" className="home-row" onClick={() => onOpen(GOOGLE_CALENDAR_DATABASE_ID, event.row.id)}>
              <span className="home-row-time">{timeOf(event)}</span>
              <span className="home-row-copy"><strong>{event.row.title || t("calendarView.defaultCalendar")}</strong>{location && <small>{location}</small>}</span>
              {tag && <span className={`home-row-tag ${tag === t("home.now") ? "is-now" : ""}`}>{tag}</span>}
            </button>
          </li>
        );
      })}
      {events.length > MAX_ROWS && <li className="home-more">{t("home.moreAppointments", { count: events.length - MAX_ROWS })}</li>}
    </ol>
  ) : <p className="home-empty">{empty}</p>;
  return (
    <Panel title={t("home.agenda")} icon="calendar" {...panel} action={<button type="button" className="text-link-button" onClick={() => onOpen(GOOGLE_CALENDAR_DATABASE_ID)}>{t("home.openCalendar")} →</button>}>
      <h3 className="home-day-heading">{t("home.today")}</h3>
      {list(calendar.today, t("home.nothingToday"), true)}
      <h3 className="home-day-heading">{t("home.tomorrow")}</h3>
      {list(tomorrow, t("home.nothingTomorrow"), false)}
    </Panel>
  );
}

/** Overdue tasks first, then today's, in one list; overdue ones are marked instead of living in a separate block. */
function HomeTasks({ items, now, onOpen, panel }: { items: Item[]; now: Date; onOpen: (id: string, rowId?: string) => void; panel: PanelState }) {
  const { language, t } = useLanguage();
  const taskDatabase = items.find((item) => item.id === GOOGLE_TASKS_DATABASE_ID && !item.trash);
  const tasks = useMemo(() => selectHomeTasks(isDatabase(taskDatabase) ? activeRows(taskDatabase) : [], now), [now, taskDatabase]);
  const rows = [...tasks.overdue, ...tasks.today];
  return (
    <Panel title={t("home.tasks")} icon="tasks" {...panel} action={<button type="button" className="text-link-button" onClick={() => onOpen(GOOGLE_TASKS_DATABASE_ID)}>{t("home.openTasks")} →</button>}>
      {rows.length ? (
        <ol className="home-rows">
          {rows.slice(0, MAX_ROWS).map((row) => {
            const due = taskDueKey(row);
            const overdue = due < tasks.todayKey;
            const list = valueText(getValue(row, GOOGLE_TASK_PROPERTY_IDS.list)).trim();
            const reminder = taskReminder(row);
            return (
              <li key={row.id}>
                <button type="button" className="home-row" onClick={() => onOpen(GOOGLE_TASKS_DATABASE_ID, row.id)}>
                  <span className={`home-row-check ${overdue ? "is-overdue" : ""}`} aria-hidden="true" />
                  <span className="home-row-copy">
                    <strong>{row.title || t("database.untitledRow")}</strong>
                    <small className={overdue ? "is-overdue" : ""}>
                      {[list, overdue ? `${t("overview.overdue")} · ${formatDueDate(due, language)}` : "", reminder ? t("home.reminder", { time: formatTime(new Date(reminder), language) }) : ""].filter(Boolean).join(" · ")}
                    </small>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      ) : <p className="home-empty">{t("home.noTasks")}</p>}
      {rows.length > MAX_ROWS && <p className="home-more">{t("home.moreTasks", { count: rows.length - MAX_ROWS })}</p>}
    </Panel>
  );
}

function QuickAdd({ taskAvailable, onQuickAdd, disabled, status }: { taskAvailable: boolean; onQuickAdd?: HomeOverviewProps["onQuickAdd"]; disabled?: boolean; status?: string }) {
  const { t } = useLanguage();
  const [kind, setKind] = useState<HomeQuickAddKind>("task");
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const blocked = Boolean(disabled || submitting || !onQuickAdd || (kind === "task" && !taskAvailable));
  const submit = () => {
    const value = text.trim();
    if (!value || blocked || !onQuickAdd) return;
    setSubmitting(true);
    try {
      const accepted = onQuickAdd(kind, value);
      if (accepted !== false) setText("");
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <section className="home-quick-add" aria-label={t("home.quickAdd")}>
      <div className="home-quick-form">
        <span className="home-quick-icon" aria-hidden="true"><InterfaceIcon name="plus" /></span>
        <label className="sr-only" htmlFor="home-quick-add-input">{t("home.quickAddPlaceholder")}</label>
        <input id="home-quick-add-input" value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); submit(); } }} placeholder={t("home.quickAddPlaceholder")} disabled={Boolean(disabled || submitting)} />
        <select value={kind} onChange={(event) => setKind(event.target.value as HomeQuickAddKind)} disabled={Boolean(disabled || submitting)} aria-label={t("home.quickAddType")}>
          <option value="task">{t("home.quickAddTask")}</option>
          <option value="note">{t("home.quickAddNote")}</option>
        </select>
        <button type="button" className="primary-button" disabled={blocked || !text.trim()} onClick={submit}>{submitting ? t("home.adding") : t("home.add")}</button>
      </div>
      {kind === "task" && !taskAvailable && <p className="home-quick-note">{t("home.quickAddNeedsTasks")}</p>}
      {status && <p className="home-quick-status" role="status">{status}</p>}
    </section>
  );
}

/** One news block: a tab per source, in the order chosen under "Customise", and the latest headlines of the chosen one. */
function HomeNews({ panel }: { panel: PanelState }) {
  const { t } = useLanguage();
  const [preferences, setPreferences] = useState<NewsPreferences>(defaultNewsPreferences);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setPreferences(readNewsPreferences()), 0);
    return () => window.clearTimeout(timer);
  }, []);
  const updatePreferences = (next: NewsPreferences) => { setPreferences(next); saveNewsPreferences(next); };
  const move = (source: NewsSource, direction: -1 | 1) => {
    const index = preferences.order.indexOf(source);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= preferences.order.length) return;
    const order = [...preferences.order];
    [order[index], order[target]] = [order[target], order[index]];
    updatePreferences({ ...preferences, order });
  };
  const active = preferences.active && preferences.order.includes(preferences.active) ? preferences.active : preferences.order[0];
  return (
    <Panel title={t("overview.newsSection")} icon="news" className="home-news" {...panel} action={<>
      <div className="home-news-tabs" role="tablist" aria-label={t("overview.newsSection")}>
        {preferences.order.map((source) => (
          <button type="button" role="tab" key={source} aria-selected={source === active} className={source === active ? "active" : ""} onClick={() => updatePreferences({ ...preferences, active: source })}>
            {NEWS_SOURCES.find((entry) => entry.source === source)?.label}
          </button>
        ))}
      </div>
      <button type="button" className="text-link-button" aria-expanded={editing} onClick={() => setEditing((current) => !current)}>{t("home.customizeNews")}</button>
    </>}>
      {editing && <div className="home-news-preferences" role="region" aria-label={t("home.customizeNews")}><p>{t("home.customizeNewsHint")}</p>{preferences.order.map((source, index) => <div className="home-news-preference-row" key={source}><span>{NEWS_SOURCES.find((entry) => entry.source === source)?.label}</span><span><button type="button" className="icon-button" aria-label={t("home.moveNewsUp")} disabled={index === 0} onClick={() => move(source, -1)}>↑</button><button type="button" className="icon-button" aria-label={t("home.moveNewsDown")} disabled={index === preferences.order.length - 1} onClick={() => move(source, 1)}>↓</button></span></div>)}</div>}
      <SlashdotFeed key={active} source={active} compact hideHeading maxStories={12} />
    </Panel>
  );
}

export function HomeOverview({ items, onOpen, onQuickAdd, quickAddDisabled, quickAddStatus }: HomeOverviewProps) {
  const { language, t } = useLanguage();
  const [now, setNow] = useState(() => new Date());
  const taskDatabase = items.find((item) => item.id === GOOGLE_TASKS_DATABASE_ID && !item.trash);
  useEffect(() => {
    const refresh = () => setNow(new Date());
    const interval = window.setInterval(refresh, 60_000);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.clearInterval(interval); document.removeEventListener("visibilitychange", refresh); };
  }, []);
  const panel = usePanels();
  const hour = hourIn(now);
  const greeting = t(hour < 12 ? "home.hello.morning" : hour < 18 ? "home.hello.afternoon" : "home.hello.evening");
  return (
    <section className="home-overview home-calm" aria-label={t("overview.aria")}>
      <header className="home-top">
        <div className="home-hello">
          <h1>{greeting}</h1>
          <p>{formatDate(now, language)}</p>
        </div>
        <QuickAdd taskAvailable={Boolean(taskDatabase && isDatabase(taskDatabase))} onQuickAdd={onQuickAdd} disabled={quickAddDisabled} status={quickAddStatus} />
      </header>
      <HomeNews panel={panel("news")} />
      <div className="home-main">
        <div className="home-stack">
          <HomeAgenda items={items} now={now} onOpen={onOpen} panel={panel("today")} />
          <HomeTasks items={items} now={now} onOpen={onOpen} panel={panel("tasks")} />
        </div>
        <Panel title={t("home.inbox")} icon="mail" className="home-inbox" {...panel("inbox")}>
          <ParroInbox compact onOpenParro={() => onOpen("parro")} />
          <GmailInbox compact onOpenInbox={() => onOpen("gmail")} />
        </Panel>
      </div>
    </section>
  );
}
