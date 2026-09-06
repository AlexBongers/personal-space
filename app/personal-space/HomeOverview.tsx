"use client";

import { useEffect, useMemo, useState } from "react";
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
import type { Item, Row } from "./types";

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
const NEWS_SOURCES: Array<{ source: NewsSource; label: string }> = [
  { source: "slashdot", label: "Slashdot" },
  { source: "tweakers", label: "Tweakers" },
  { source: "nos", label: "NOS" },
  { source: "bunniksnieuws", label: "Bunniks Nieuws" },
];

type NewsPreferences = {
  version: 1;
  order: NewsSource[];
  collapsed: Partial<Record<NewsSource, boolean>>;
};

const defaultNewsPreferences = (): NewsPreferences => ({
  version: 1,
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
    const order = Array.isArray(parsed.order) ? parsed.order.filter(validNewsSource) : [];
    const completeOrder = [...order, ...fallback.order.filter((source) => !order.includes(source))];
    const collapsed = parsed.collapsed && typeof parsed.collapsed === "object"
      ? Object.fromEntries(Object.entries(parsed.collapsed).filter(([source, value]) => validNewsSource(source) && typeof value === "boolean")) as NewsPreferences["collapsed"]
      : {};
    return { version: 1, order: completeOrder, collapsed };
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

type TasksListProps = {
  rows: Row[];
  todayKey: string;
  emptyLabel: string;
  language: "en" | "nl";
  onOpen: (rowId: string) => void;
};

function TasksList({ rows, todayKey, emptyLabel, language, onOpen }: TasksListProps) {
  const { t } = useLanguage();
  if (!rows.length) return <p className="home-tasks-empty">{emptyLabel}</p>;
  return (
    <ol className="home-task-list">
      {rows.slice(0, 5).map((row) => {
        const due = taskDueKey(row);
        const list = valueText(getValue(row, GOOGLE_TASK_PROPERTY_IDS.list)).trim() || t("tasks.noList");
        const overdue = Boolean(due && due < todayKey);
        const dueLabel = due === todayKey
          ? t("overview.today")
          : overdue
            ? `${t("overview.overdue")} · ${formatDueDate(due, language)}`
            : due
              ? formatDueDate(due, language)
              : "";
        return (
          <li key={row.id}>
            <button type="button" className="home-task-row" onClick={() => onOpen(row.id)}>
              <span className={`home-task-check ${overdue ? "overdue" : ""}`} aria-hidden="true" />
              <span className="home-task-copy">
                <span className="home-task-title">{row.title || t("database.untitledRow")}</span>
                <span className={`home-task-meta ${due === todayKey ? "today" : overdue ? "overdue" : ""}`}>{list}{dueLabel ? ` · ${dueLabel}` : ""}</span>
              </span>
              <span className="home-task-arrow" aria-hidden="true">→</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function HomeToday({ items, now, onOpen }: { items: Item[]; now: Date; onOpen: (id: string, rowId?: string) => void }) {
  const { language, t } = useLanguage();
  const taskDatabase = items.find((item) => item.id === GOOGLE_TASKS_DATABASE_ID);
  const calendarDatabase = items.find((item) => item.id === GOOGLE_CALENDAR_DATABASE_ID);
  const tasks = useMemo(() => selectHomeTasks(isDatabase(taskDatabase) ? taskDatabase.rows : [], now), [now, taskDatabase]);
  const calendar = useMemo(() => selectHomeCalendar(isDatabase(calendarDatabase) ? calendarDatabase.rows : [], now), [now, calendarDatabase]);
  const dateText = formatDate(now, language);
  const allTodayEvents = calendar.today;
  const formatEvent = (event: typeof allTodayEvents[number]) => {
    if (event.allDay) return t("home.allDay");
    if (!event.start) return t("home.unknownStart");
    if (!event.end || event.unknownEnd) return formatTime(event.start, language);
    return `${formatTime(event.start, language)}–${formatTime(event.end, language)}`;
  };
  const focus = calendar.current || calendar.next;
  return (
    <section className="home-card home-today-card" aria-labelledby="home-today-heading">
      <div className="home-card-heading">
        <div>
          <span className="home-eyebrow">{t("home.eyebrow")}</span>
          <h1 id="home-today-heading">{dateText}</h1>
          <p className="home-card-note">{t("home.sourceNote", { timeZone: HOME_TIME_ZONE })}</p>
        </div>
        <span className="home-date-chip" aria-label={dateText}>{new Intl.DateTimeFormat(language === "nl" ? "nl-NL" : "en-US", { timeZone: HOME_TIME_ZONE, day: "numeric", month: "short" }).format(now)}</span>
      </div>
      {focus ? (
        <div className={`home-calendar-focus ${calendar.current ? "is-current" : ""}`}>
          <span className="home-focus-dot" aria-hidden="true" />
          <span><strong>{calendar.current ? t("home.inProgress") : t("home.nextAppointment")}</strong><span>{focus.row.title || t("calendarView.defaultCalendar")} · {formatEvent(focus)}</span></span>
        </div>
      ) : (
        <p className="home-calendar-empty">{t("home.noAppointment")}</p>
      )}
      <div className="home-today-grid">
        <section className="home-today-column" aria-labelledby="home-agenda-heading">
          <div className="home-subheading"><h2 id="home-agenda-heading"><InterfaceIcon name="calendar" />{t("home.appointments")}</h2><button type="button" className="text-button" onClick={() => onOpen(GOOGLE_CALENDAR_DATABASE_ID)}>{t("home.allAppointments")}</button></div>
          {allTodayEvents.length ? (
            <ol className="home-agenda-list">
              {allTodayEvents.slice(0, 5).map((event) => (
                <li key={event.row.id}>
                  <button type="button" className="home-agenda-row" onClick={() => onOpen(GOOGLE_CALENDAR_DATABASE_ID, event.row.id)}>
                    <span className="home-agenda-time">{formatEvent(event)}</span>
                    <span className="home-agenda-copy"><strong>{event.row.title || t("calendarView.defaultCalendar")}</strong>{calendarRowText(event.row, GOOGLE_CALENDAR_PROPERTY_IDS.location) && <small>{calendarRowText(event.row, GOOGLE_CALENDAR_PROPERTY_IDS.location)}</small>}</span>
                    <span aria-hidden="true">→</span>
                  </button>
                </li>
              ))}
            </ol>
          ) : <p className="home-tasks-empty">{t("home.noAppointmentsToday")}</p>}
          {allTodayEvents.length > 5 && <p className="home-list-total">{t("home.moreAppointments", { count: allTodayEvents.length - 5 })}</p>}
        </section>
        <section className="home-today-column" aria-labelledby="home-tasks-heading">
          <div className="home-subheading"><h2 id="home-tasks-heading"><InterfaceIcon name="tasks" />{t("home.tasksToday")}</h2><button type="button" className="text-button" onClick={() => onOpen(GOOGLE_TASKS_DATABASE_ID)}>{t("home.allTasks")}</button></div>
          <TasksList rows={tasks.today} todayKey={tasks.todayKey} emptyLabel={t("home.noTasksToday")} language={language} onOpen={(rowId) => onOpen(GOOGLE_TASKS_DATABASE_ID, rowId)} />
          {tasks.today.length > 5 && <p className="home-list-total">{t("home.moreTasks", { count: tasks.today.length - 5 })}</p>}
        </section>
      </div>
    </section>
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
    <section className="home-card home-quick-add" aria-labelledby="home-quick-add-heading">
      <div className="home-subheading"><h2 id="home-quick-add-heading"><InterfaceIcon name="plus" />{t("home.quickAdd")}</h2></div>
      <div className="home-quick-form">
        <label className="sr-only" htmlFor="home-quick-add-input">{t("home.quickAddPlaceholder")}</label>
        <input id="home-quick-add-input" value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); submit(); } }} placeholder={t("home.quickAddPlaceholder")} disabled={Boolean(disabled || submitting)} />
        <select value={kind} onChange={(event) => setKind(event.target.value as HomeQuickAddKind)} disabled={Boolean(disabled || submitting)} aria-label={t("home.quickAddType")}>
          <option value="task">{t("home.quickAddTask")}</option>
          <option value="note">{t("home.quickAddNote")}</option>
        </select>
        <button type="button" className="primary-button" disabled={blocked || !text.trim()} onClick={submit}>{submitting ? t("home.adding") : t("home.add")}</button>
      </div>
      <p className="home-card-note">{kind === "task" && !taskAvailable ? t("home.quickAddNeedsTasks") : kind === "task" ? t("home.quickAddTaskHint") : t("home.quickAddNoteHint")}</p>
      {status && <p className="home-quick-status" role="status">{status}</p>}
    </section>
  );
}

function AttentionPanel({ tasks, onOpen }: { tasks: ReturnType<typeof selectHomeTasks>; onOpen: (id: string, rowId?: string) => void }) {
  const { language, t } = useLanguage();
  return (
    <section className="home-section" aria-labelledby="home-attention-heading">
      <div className="home-section-heading"><div><span className="home-eyebrow">{t("home.eyebrowAttention")}</span><h2 id="home-attention-heading">{t("home.attention")}</h2></div><span className="home-section-count">{tasks.overdue.length}</span></div>
      <div className="home-attention-grid">
        <section className="home-card home-overdue-card" aria-labelledby="home-overdue-heading">
          <div className="home-subheading"><h3 id="home-overdue-heading">{t("home.overdueTasks")}</h3><button type="button" className="text-button" onClick={() => onOpen(GOOGLE_TASKS_DATABASE_ID)}>{t("home.allTasks")}</button></div>
          <TasksList rows={tasks.overdue} todayKey={tasks.todayKey} emptyLabel={t("home.noOverdue")} language={language} onOpen={(rowId) => onOpen(GOOGLE_TASKS_DATABASE_ID, rowId)} />
          {tasks.overdue.length > 5 && <p className="home-list-total">{t("home.moreOverdue", { count: tasks.overdue.length - 5 })}</p>}
        </section>
        <ParroInbox compact onOpenParro={() => onOpen("parro")} />
      </div>
    </section>
  );
}

function HomeNews() {
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
  const toggle = (source: NewsSource) => updatePreferences({ ...preferences, collapsed: { ...preferences.collapsed, [source]: !preferences.collapsed[source] } });
  return (
    <section className="home-section home-news-section" aria-labelledby="home-news-heading">
      <div className="home-section-heading"><div><span className="home-eyebrow">{t("home.eyebrowNews")}</span><h2 id="home-news-heading">{t("overview.newsSection")}</h2></div><button type="button" className="small-button" aria-expanded={editing} onClick={() => setEditing((current) => !current)}>{t("home.customizeNews")}</button></div>
      {editing && <div className="home-news-preferences" role="region" aria-label={t("home.customizeNews")}><p>{t("home.customizeNewsHint")}</p>{preferences.order.map((source, index) => <div className="home-news-preference-row" key={source}><span>{NEWS_SOURCES.find((entry) => entry.source === source)?.label}</span><span><button type="button" className="icon-button" aria-label={t("home.moveNewsUp")} disabled={index === 0} onClick={() => move(source, -1)}>↑</button><button type="button" className="icon-button" aria-label={t("home.moveNewsDown")} disabled={index === preferences.order.length - 1} onClick={() => move(source, 1)}>↓</button></span></div>)}</div>}
      <div className="home-news-list">
        {preferences.order.map((source) => {
          const label = NEWS_SOURCES.find((entry) => entry.source === source)?.label || source;
          const collapsed = Boolean(preferences.collapsed[source]);
          const contentId = `home-news-${source}`;
          return <article className={`home-news-source ${collapsed ? "is-collapsed" : ""}`} key={source}>
            <button type="button" className="home-news-toggle" aria-expanded={!collapsed} aria-controls={contentId} onClick={() => toggle(source)}><span>{label}</span><span aria-hidden="true">{collapsed ? "+" : "−"}</span></button>
            <div id={contentId} className="home-news-content" hidden={collapsed}><SlashdotFeed source={source} compact hideHeading /></div>
          </article>;
        })}
      </div>
    </section>
  );
}

export function HomeOverview({ items, onOpen, onQuickAdd, quickAddDisabled, quickAddStatus }: HomeOverviewProps) {
  const { t } = useLanguage();
  const [now, setNow] = useState(() => new Date());
  const taskDatabase = items.find((item) => item.id === GOOGLE_TASKS_DATABASE_ID);
  const tasks = useMemo(() => selectHomeTasks(isDatabase(taskDatabase) ? taskDatabase.rows : [], now), [now, taskDatabase]);
  useEffect(() => {
    const refresh = () => setNow(new Date());
    const interval = window.setInterval(refresh, 60_000);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.clearInterval(interval); document.removeEventListener("visibilitychange", refresh); };
  }, []);
  return (
    <section className="home-overview" aria-label={t("overview.aria")}>
      <HomeToday items={items} now={now} onOpen={onOpen} />
      <QuickAdd taskAvailable={Boolean(taskDatabase && isDatabase(taskDatabase))} onQuickAdd={onQuickAdd} disabled={quickAddDisabled} status={quickAddStatus} />
      <AttentionPanel tasks={tasks} onOpen={onOpen} />
      <section className="home-section" aria-labelledby="home-gmail-heading"><div className="sr-only" id="home-gmail-heading">{t("gmail.title")}</div><GmailInbox compact onOpenInbox={() => onOpen("gmail")} /></section>
      <HomeNews />
    </section>
  );
}
