"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  GOOGLE_CALENDAR_PROPERTY_IDS,
  GOOGLE_TASK_PROPERTY_IDS,
  getValue,
  valueText,
} from "./model";
import { useLanguage } from "./i18n";
import {
  CALENDAR_TIME_ZONE,
  addCalendarDays,
  addCalendarMonths,
  calendarDaysFrom,
  calendarMonthKey,
  calendarTodayKey,
  compareCalendarEvents,
  parseCalendarEvents,
  selectParsedCalendarEventsForVisibleDays,
  startOfCalendarWeek,
  type CalendarEvent,
} from "./calendar-model.ts";
import type { CellValue, Database, Row } from "./types";

type IntegrationViewProps = {
  database: Database;
  rows: Row[];
  onOpenRow: (rowId: string) => void;
  onUpdateCell: (rowId: string, propertyId: string, value: CellValue) => void;
  onAddRow: (initialValues?: Record<string, CellValue>) => string;
  onDeleteRow: (rowId: string) => void;
};

const dateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const valueFor = (row: Row, propertyId: string) => valueText(getValue(row, propertyId)).trim();

const taskIsDone = (row: Row) => {
  const status = valueFor(row, GOOGLE_TASK_PROPERTY_IDS.status).toLowerCase();
  return status === "done" || status === "completed" || status === "complete";
};

const taskDueKey = (row: Row) => valueFor(row, GOOGLE_TASK_PROPERTY_IDS.due).slice(0, 10);

function formatTaskDue(value: string, formatter: Intl.DateTimeFormat) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return formatter.format(date);
}

function taskDueTone(value: string) {
  if (!value) return "";
  const today = dateKey(new Date());
  return value < today ? "overdue" : value === today ? "today" : "";
}

export function GoogleTasksInterface({ database, rows, onOpenRow, onUpdateCell, onAddRow, onDeleteRow }: IntegrationViewProps) {
  const { language, t } = useLanguage();
  const [statusFilter, setStatusFilter] = useState<"open" | "all" | "done">("open");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const dueFormatter = useMemo(() => new Intl.DateTimeFormat(language === "nl" ? "nl-NL" : "en-US", { day: "numeric", month: "short", year: "numeric" }), [language]);
  const counts = useMemo(() => ({
    all: rows.length,
    done: rows.filter(taskIsDone).length,
    open: rows.filter((row) => !taskIsDone(row)).length,
  }), [rows]);

  const groupedRows = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();
    const filtered = rows
      .filter((row) => statusFilter === "all" || (statusFilter === "done" ? taskIsDone(row) : !taskIsDone(row)))
      .filter((row) => {
        if (!normalizedQuery) return true;
        return [row.title, valueFor(row, GOOGLE_TASK_PROPERTY_IDS.notes), valueFor(row, GOOGLE_TASK_PROPERTY_IDS.list)]
          .some((value) => value.toLowerCase().includes(normalizedQuery));
      })
      .sort((a, b) => {
        const aDue = taskDueKey(a) || "9999-12-31";
        const bDue = taskDueKey(b) || "9999-12-31";
        return aDue.localeCompare(bDue) || a.title.localeCompare(b.title, language);
      });
    const groups = new Map<string, Row[]>();
    filtered.forEach((row) => {
      const list = valueFor(row, GOOGLE_TASK_PROPERTY_IDS.list) || t("tasks.noList");
      const group = groups.get(list);
      if (group) group.push(row);
      else groups.set(list, [row]);
    });
    return [...groups.entries()];
  }, [deferredQuery, language, rows, statusFilter, t]);

  const addTask = () => {
    const id = onAddRow({ [GOOGLE_TASK_PROPERTY_IDS.status]: "Open" });
    onOpenRow(id);
  };

  return (
    <div className="integration-page tasks-interface">
      <h1 className="visually-hidden">{database.title}</h1>
      <div className="integration-toolbar">
        <div className="task-filter-tabs" role="tablist" aria-label={t("tasks.filterLabel")}>
          {(["open", "all", "done"] as const).map((filter) => (
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === filter}
              className={statusFilter === filter ? "active" : ""}
              key={filter}
              onClick={() => setStatusFilter(filter)}
            >
              {t(`tasks.filter.${filter}`)} <span>{counts[filter]}</span>
            </button>
          ))}
        </div>
        <div className="integration-actions"><label className="integration-search">
          <span aria-hidden="true">⌕</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("tasks.search")} aria-label={t("tasks.search")} />
        </label>
        <button type="button" className="primary-button" onClick={addTask}>＋ {t("tasks.newTask")}</button></div>
      </div>

      <div className="task-groups">
        {groupedRows.map(([list, groupRows]) => (
          <section className="task-group" key={list}>
            <div className="task-group-heading"><span className="task-list-dot" /><h2>{list}</h2><span>{groupRows.length}</span></div>
            <div className="task-list">
              {groupRows.map((row) => {
                const done = taskIsDone(row);
                const due = taskDueKey(row);
                const notes = valueFor(row, GOOGLE_TASK_PROPERTY_IDS.notes);
                return (
                  <div className={`task-item ${done ? "is-done" : ""}`} key={row.id}>
                    <button
                      type="button"
                      className="task-check"
                      aria-label={done ? t("tasks.markOpen", { title: row.title }) : t("tasks.markDone", { title: row.title })}
                      aria-pressed={done}
                      onClick={() => onUpdateCell(row.id, GOOGLE_TASK_PROPERTY_IDS.status, done ? "Open" : "Done")}
                    >{done ? "✓" : ""}</button>
                    <button type="button" className="task-main" onClick={() => onOpenRow(row.id)}>
                      <strong>{row.title || t("database.untitledRow")}</strong>
                      <span className="task-detail-line">
                        {due && <time className={taskDueTone(due)} dateTime={due}>{formatTaskDue(due, dueFormatter)}</time>}
                        {notes && <span className="task-notes-preview">{notes}</span>}
                      </span>
                    </button>
                    <button type="button" className="task-open" aria-label={`${t("database.openRow")}: ${row.title}`} onClick={() => onOpenRow(row.id)}>→</button>
                    <button type="button" className="task-delete" aria-label={`${t("database.deleteRowLabel")}: ${row.title}`} onClick={() => onDeleteRow(row.id)}>×</button>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      {groupedRows.length === 0 && <div className="integration-empty"><span className="empty-icon">✓</span><strong>{t("tasks.emptyTitle")}</strong><p>{query ? t("tasks.emptySearch") : t("tasks.emptyHint")}</p></div>}
    </div>
  );
}

function calendarColor(value: string) {
  const colors = ["#209dd7", "#753991", "#35a77c", "#ecad0a", "#d6574b"];
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = (hash * 31 + value.charCodeAt(index)) | 0;
  return colors[Math.abs(hash) % colors.length];
}

const dateFromKey = (key: string) => new Date(key + "T12:00:00Z");

const formatDateRange = (event: CalendarEvent, locale: string) => {
  const formatter = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: CALENDAR_TIME_ZONE });
  const start = formatter.format(dateFromKey(event.startDateKey));
  if (event.allDay) {
    const lastDay = addCalendarDays(event.endDateKey, -1);
    return lastDay && lastDay !== event.startDateKey ? start + "–" + formatter.format(dateFromKey(lastDay)) : start;
  }
  if (!event.start || !event.end || event.unknownEnd) return start;
  const timeFormatter = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone: CALENDAR_TIME_ZONE });
  const startLabel = start + " " + timeFormatter.format(event.start);
  const endDate = event.endDateKey === event.startDateKey ? "" : formatter.format(dateFromKey(event.endDateKey)) + " ";
  return startLabel + "–" + endDate + timeFormatter.format(event.end);
};

const formatEventTime = (event: CalendarEvent, dayKey: string, locale: string, allDayLabel: string, continuesLabel: string) => {
  if (event.startDateKey < dayKey) return continuesLabel;
  if (event.allDay) return allDayLabel;
  if (!event.start) return "";
  return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone: CALENDAR_TIME_ZONE }).format(event.start);
};

type CalendarAgendaProps = {
  events: CalendarEvent[];
  dayKey?: string;
  onOpenRow: (rowId: string) => void;
};

function CalendarAgenda({ events, dayKey, onOpenRow }: CalendarAgendaProps) {
  const { language, t } = useLanguage();
  const locale = language === "nl" ? "nl-NL" : "en-US";
  const dateFormatter = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", timeZone: CALENDAR_TIME_ZONE }), [locale]);
  const timeFormatter = useMemo(() => new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone: CALENDAR_TIME_ZONE }), [locale]);
  return <div className="calendar-agenda">
    {events.map((event) => {
      const label = dayKey ? dateFormatter.format(dateFromKey(dayKey)) : formatDateRange(event, locale);
      const time = dayKey
        ? formatEventTime(event, dayKey, locale, t("calendarView.allDay"), t("calendarView.continues"))
        : event.allDay
          ? t("calendarView.allDay")
          : event.start
            ? timeFormatter.format(event.start)
            : "";
      const calendar = valueText(getValue(event.row, GOOGLE_CALENDAR_PROPERTY_IDS.calendar));
      const location = valueText(getValue(event.row, GOOGLE_CALENDAR_PROPERTY_IDS.location));
      return <button type="button" className="agenda-event" key={event.row.id} onClick={() => onOpenRow(event.row.id)}>
        <span className="agenda-date"><strong>{label}</strong><small>{time}</small></span>
        <i style={{ background: calendarColor(calendar) }} />
        <span className="agenda-copy"><strong>{event.row.title || t("database.untitledRow")}</strong><small>{calendar || t("calendarView.defaultCalendar")}{location ? " · " + location : ""}</small></span>
        <span className="agenda-arrow" aria-hidden="true">→</span>
      </button>;
    })}
    {!events.length && <p className="calendar-empty">{t("calendarView.noEvents")}</p>}
  </div>;
}

export function GoogleCalendarInterface({ database, rows, onOpenRow, onAddRow }: IntegrationViewProps) {
  const { language, t } = useLanguage();
  const [now, setNow] = useState(() => new Date());
  const initialToday = calendarTodayKey(new Date());
  const [selectedDay, setSelectedDay] = useState(initialToday);
  const [cursorMonth, setCursorMonth] = useState(calendarMonthKey(initialToday));
  const [mode, setMode] = useState<"month" | "week" | "agenda">("month");
  const [agendaDay, setAgendaDay] = useState<string | null>(null);
  const locale = language === "nl" ? "nl-NL" : "en-US";
  const today = calendarTodayKey(now);
  const monthFormatter = useMemo(() => new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: CALENDAR_TIME_ZONE }), [locale]);
  const weekdayFormatter = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: CALENDAR_TIME_ZONE }), [locale]);
  const fullDateFormatter = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: "full", timeZone: CALENDAR_TIME_ZONE }), [locale]);
  const selectedDateFormatter = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", timeZone: CALENDAR_TIME_ZONE }), [locale]);

  useEffect(() => {
    const refresh = () => setNow(new Date());
    const interval = window.setInterval(refresh, 60_000);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.clearInterval(interval); document.removeEventListener("visibilitychange", refresh); };
  }, []);

  const monthStart = cursorMonth ? cursorMonth + "-01" : initialToday;
  const monthDayCount = cursorMonth ? new Date(Date.UTC(Number(cursorMonth.slice(0, 4)), Number(cursorMonth.slice(5, 7)), 0)).getUTCDate() : 0;
  const monthFirstWeekday = monthDayCount ? (dateFromKey(monthStart).getUTCDay() + 6) % 7 : 0;
  const monthGridStart = addCalendarDays(monthStart, -monthFirstWeekday);
  const monthDays = useMemo(() => calendarDaysFrom(monthGridStart, Math.ceil((monthFirstWeekday + monthDayCount) / 7) * 7), [monthDayCount, monthFirstWeekday, monthGridStart]);
  const monthActualDays = useMemo(() => calendarDaysFrom(monthStart, monthDayCount), [monthDayCount, monthStart]);
  const weekDays = useMemo(() => calendarDaysFrom(startOfCalendarWeek(selectedDay), 7), [selectedDay]);
  const visibleDayKeys = mode === "week" ? weekDays : monthDays;
  const parsedEvents = useMemo(() => parseCalendarEvents(rows), [rows]);
  const eventsByDay = useMemo(() => selectParsedCalendarEventsForVisibleDays(parsedEvents, visibleDayKeys), [parsedEvents, visibleDayKeys]);
  const monthAgendaByDay = useMemo(() => selectParsedCalendarEventsForVisibleDays(parsedEvents, monthActualDays), [monthActualDays, parsedEvents]);
  const agendaEvents = useMemo(() => {
    if (agendaDay) return monthAgendaByDay.get(agendaDay) || [];
    const unique = new Map<string, CalendarEvent>();
    monthAgendaByDay.forEach((events) => events.forEach((event) => unique.set(event.row.id, event)));
    return [...unique.values()].sort(compareCalendarEvents);
  }, [agendaDay, monthAgendaByDay]);
  const monthLabel = monthFormatter.format(dateFromKey(monthStart));
  const weekLabel = selectedDateFormatter.format(dateFromKey(weekDays[0])) + "–" + selectedDateFormatter.format(dateFromKey(weekDays[6]));
  const agendaLabel = agendaDay ? selectedDateFormatter.format(dateFromKey(agendaDay)) : monthLabel;
  const weekdays = useMemo(() => calendarDaysFrom("2024-01-01", 7).map((key) => weekdayFormatter.format(dateFromKey(key))), [weekdayFormatter]);

  const addEvent = () => {
    const id = onAddRow({
      [GOOGLE_CALENDAR_PROPERTY_IDS.status]: "Confirmed",
      [GOOGLE_CALENDAR_PROPERTY_IDS.start]: selectedDay,
      [GOOGLE_CALENDAR_PROPERTY_IDS.allDay]: true,
    });
    onOpenRow(id);
  };

  const movePeriod = (amount: number) => {
    if (mode === "week") {
      const nextDay = addCalendarDays(selectedDay, amount * 7);
      setSelectedDay(nextDay);
      setCursorMonth(calendarMonthKey(nextDay));
    } else {
      const nextMonth = addCalendarMonths(cursorMonth, amount);
      setCursorMonth(nextMonth);
      setSelectedDay(nextMonth + "-01");
    }
    setAgendaDay(null);
  };

  const resetToday = () => {
    setSelectedDay(today);
    setCursorMonth(calendarMonthKey(today));
    setAgendaDay(null);
  };

  const changeMode = (nextMode: "month" | "week" | "agenda") => {
    setMode(nextMode);
    if (nextMode !== "agenda") setAgendaDay(null);
  };

  const selectDay = (key: string) => {
    setSelectedDay(key);
    if (mode === "month") setCursorMonth(calendarMonthKey(key));
  };

  const renderEvent = (event: CalendarEvent, dayKey: string) => (
    <button type="button" className={"calendar-event " + (event.startDateKey < dayKey ? "is-continuation" : "")} key={event.row.id} onClick={() => onOpenRow(event.row.id)}>
      <i style={{ background: calendarColor(valueText(getValue(event.row, GOOGLE_CALENDAR_PROPERTY_IDS.calendar))) }} />
      <span>{formatEventTime(event, dayKey, locale, t("calendarView.allDay"), t("calendarView.continues"))}</span>
      <strong>{event.row.title || t("database.untitledRow")}</strong>
    </button>
  );

  const renderMonthDay = (key: string) => {
    const dayEvents = eventsByDay.get(key) || [];
    const date = dateFromKey(key);
    return <div className={"calendar-day " + (key.slice(0, 7) === cursorMonth ? "" : "outside-month") + " " + (key === today ? "is-today" : "")} role="gridcell" key={key}>
      <button type="button" className="calendar-day-number" aria-label={fullDateFormatter.format(date)} aria-pressed={selectedDay === key} aria-current={key === today ? "date" : undefined} onClick={() => selectDay(key)}>{date.getUTCDate()}{key === today && <span>{t("calendarView.todayShort")}</span>}</button>
      <span className="mobile-event-count" aria-hidden="true">{dayEvents.length > 0 ? dayEvents.length : ""}</span>
      <div className="calendar-day-events">{dayEvents.slice(0, 3).map((event) => renderEvent(event, key))}{dayEvents.length > 3 && <button type="button" className="calendar-more" onClick={() => { setAgendaDay(key); setSelectedDay(key); setMode("agenda"); }}>+{dayEvents.length - 3} {t("calendarView.more")}</button>}</div>
    </div>;
  };

  return (
    <div className="integration-page calendar-interface">
      <h1 className="visually-hidden">{database.title}</h1>
      <div className="calendar-toolbar">
        <div className="calendar-navigation">
          <button type="button" className="today-button" onClick={resetToday}>{t("calendarView.today")}</button>
          <button type="button" className="calendar-nav-button" aria-label={t("calendarView.previous")} onClick={() => movePeriod(-1)}>‹</button>
          <button type="button" className="calendar-nav-button" aria-label={t("calendarView.next")} onClick={() => movePeriod(1)}>›</button>
          <h2>{mode === "week" ? weekLabel : mode === "agenda" ? agendaLabel : monthLabel}</h2>
        </div>
        <div className="integration-actions"><div className="calendar-mode-tabs" role="tablist" aria-label={t("calendarView.viewLabel")}>
          {(["month", "week", "agenda"] as const).map((view) => (
            <button type="button" role="tab" aria-selected={mode === view} className={mode === view ? "active" : ""} key={view} onClick={() => changeMode(view)}>{t("calendarView." + view)}</button>
          ))}
        </div>
        <button type="button" className="primary-button" onClick={addEvent}>＋ {t("calendarView.newEvent")}</button></div>
      </div>

      {mode === "month" && <><div className="calendar-grid" role="grid" aria-label={monthLabel}>
        {weekdays.map((day) => <div className="calendar-weekday" role="columnheader" key={day}>{day}</div>)}
        {monthDays.map(renderMonthDay)}
      </div>
      <section className="calendar-day-agenda" aria-label={t("calendarView.agenda")}>
        <h2>{selectedDateFormatter.format(dateFromKey(selectedDay))}</h2>
        <CalendarAgenda events={eventsByDay.get(selectedDay) || []} dayKey={selectedDay} onOpenRow={onOpenRow} />
      </section></>}

      {mode === "week" && <section className="calendar-week-view" aria-label={weekLabel}>
        {weekDays.map((key) => {
          const dayEvents = eventsByDay.get(key) || [];
          return <article className={"calendar-week-day " + (key === today ? "is-today" : "")} key={key}>
            <button type="button" className="calendar-week-day-heading" aria-pressed={selectedDay === key} onClick={() => selectDay(key)}><strong>{weekdayFormatter.format(dateFromKey(key))}</strong><span>{dateFromKey(key).getUTCDate()}</span></button>
            <div className="calendar-week-all-day">{dayEvents.filter((event) => event.allDay).map((event) => renderEvent(event, key))}</div>
            <div className="calendar-week-timed">{dayEvents.filter((event) => !event.allDay).map((event) => renderEvent(event, key))}</div>
            {!dayEvents.length && <p className="calendar-empty">{t("calendarView.noEvents")}</p>}
          </article>;
        })}
      </section>}

      {mode === "agenda" && <section className="calendar-day-agenda" aria-label={t("calendarView.agenda")}>
        {agendaDay && <button type="button" className="back-link" onClick={() => setAgendaDay(null)}>← {monthLabel}</button>}
        <h2>{agendaDay ? selectedDateFormatter.format(dateFromKey(agendaDay)) : monthLabel}</h2>
        <CalendarAgenda events={agendaEvents} dayKey={agendaDay || undefined} onOpenRow={onOpenRow} />
      </section>}
    </div>
  );
}
