"use client";

import { useDeferredValue, useMemo, useState } from "react";
import {
  GOOGLE_CALENDAR_PROPERTY_IDS,
  GOOGLE_TASK_PROPERTY_IDS,
  getValue,
  valueText,
} from "./model";
import { useLanguage } from "./i18n";
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

function calendarRowDate(row: Row) {
  const start = valueFor(row, GOOGLE_CALENDAR_PROPERTY_IDS.start);
  if (/^\d{4}-\d{2}-\d{2}/.test(start)) return start.slice(0, 10);
  const parsed = new Date(start);
  return Number.isNaN(parsed.getTime()) ? "" : dateKey(parsed);
}

function calendarColor(value: string) {
  const colors = ["#209dd7", "#753991", "#35a77c", "#ecad0a", "#d6574b"];
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = (hash * 31 + value.charCodeAt(index)) | 0;
  return colors[Math.abs(hash) % colors.length];
}

function formatCalendarTime(row: Row, allDayLabel: string, formatter: Intl.DateTimeFormat) {
  if (valueFor(row, GOOGLE_CALENDAR_PROPERTY_IDS.allDay) === "true" || !valueFor(row, GOOGLE_CALENDAR_PROPERTY_IDS.start).includes("T")) return allDayLabel;
  const date = new Date(valueFor(row, GOOGLE_CALENDAR_PROPERTY_IDS.start));
  if (Number.isNaN(date.getTime())) return "";
  return formatter.format(date);
}

function CalendarAgenda({ rows, onOpenRow }: Pick<IntegrationViewProps, "rows" | "onOpenRow">) {
  const { language, t } = useLanguage();
  const locale = language === "nl" ? "nl-NL" : "en-US";
  const dateFormatter = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short" }), [locale]);
  const timeFormatter = useMemo(() => new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }), [locale]);
  return <div className="calendar-agenda">
    {rows.map((row) => {
      const day = calendarRowDate(row);
      const date = new Date(`${day}T12:00:00`);
      const label = Number.isNaN(date.getTime()) ? day : dateFormatter.format(date);
      return <button type="button" className="agenda-event" key={row.id} onClick={() => onOpenRow(row.id)}>
        <span className="agenda-date"><strong>{label}</strong><small>{formatCalendarTime(row, t("calendarView.allDay"), timeFormatter)}</small></span>
        <i style={{ background: calendarColor(valueFor(row, GOOGLE_CALENDAR_PROPERTY_IDS.calendar)) }} />
        <span className="agenda-copy"><strong>{row.title || t("database.untitledRow")}</strong><small>{valueFor(row, GOOGLE_CALENDAR_PROPERTY_IDS.calendar) || t("calendarView.defaultCalendar")}{valueFor(row, GOOGLE_CALENDAR_PROPERTY_IDS.location) ? ` · ${valueFor(row, GOOGLE_CALENDAR_PROPERTY_IDS.location)}` : ""}</small></span>
        <span className="agenda-arrow" aria-hidden="true">→</span>
      </button>;
    })}
    {!rows.length && <p className="calendar-empty">{t("calendarView.noEvents")}</p>}
  </div>;
}

export function GoogleCalendarInterface({ database, rows, onOpenRow, onAddRow }: IntegrationViewProps) {
  const { language, t } = useLanguage();
  const [cursor, setCursor] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [mode, setMode] = useState<"month" | "agenda">("month");
  const [selectedDay, setSelectedDay] = useState(() => dateKey(new Date()));
  const [agendaDay, setAgendaDay] = useState<string | null>(null);
  const locale = language === "nl" ? "nl-NL" : "en-US";
  const today = dateKey(new Date());
  const monthFormatter = useMemo(() => new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }), [locale]);
  const weekdayFormatter = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: "short" }), [locale]);
  const fullDateFormatter = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: "full" }), [locale]);
  const selectedDateFormatter = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" }), [locale]);
  const timeFormatter = useMemo(() => new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }), [locale]);

  const eventsByDay = useMemo(() => {
    const grouped = new Map<string, Row[]>();
    rows.forEach((row) => {
      const day = calendarRowDate(row);
      if (day) {
        const group = grouped.get(day);
        if (group) group.push(row);
        else grouped.set(day, [row]);
      }
    });
    grouped.forEach((dayRows, day) => {
      grouped.set(
        day,
        [...dayRows].sort((a, b) => valueFor(a, GOOGLE_CALENDAR_PROPERTY_IDS.start).localeCompare(valueFor(b, GOOGLE_CALENDAR_PROPERTY_IDS.start))),
      );
    });
    return grouped;
  }, [rows]);

  const monthDays = useMemo(() => {
    const firstDay = (new Date(cursor.getFullYear(), cursor.getMonth(), 1).getDay() + 6) % 7;
    const totalDays = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const cellCount = Math.ceil((firstDay + totalDays) / 7) * 7;
    return Array.from({ length: cellCount }, (_, index) => {
      const day = index - firstDay + 1;
      const date = new Date(cursor.getFullYear(), cursor.getMonth(), day);
      return { date, key: dateKey(date), inMonth: date.getMonth() === cursor.getMonth() };
    });
  }, [cursor]);

  const monthLabel = monthFormatter.format(cursor);
  const monthKey = dateKey(cursor).slice(0, 7);
  const agendaRows = useMemo(() => [...rows]
    .filter((row) => agendaDay ? calendarRowDate(row) === agendaDay : calendarRowDate(row).startsWith(monthKey))
    .sort((a, b) => valueFor(a, GOOGLE_CALENDAR_PROPERTY_IDS.start).localeCompare(valueFor(b, GOOGLE_CALENDAR_PROPERTY_IDS.start)))
    , [rows, monthKey, agendaDay]);

  const addEvent = () => {
    const id = onAddRow({
      [GOOGLE_CALENDAR_PROPERTY_IDS.status]: "Confirmed",
      [GOOGLE_CALENDAR_PROPERTY_IDS.start]: mode === "month" ? selectedDay : agendaDay || dateKey(cursor),
      [GOOGLE_CALENDAR_PROPERTY_IDS.allDay]: true,
    });
    onOpenRow(id);
  };

  const moveMonth = (amount: number) => {
    const next = new Date(cursor.getFullYear(), cursor.getMonth() + amount, 1);
    setCursor(next);
    setSelectedDay(dateKey(next));
    setAgendaDay(null);
  };
  const resetToday = () => {
    setCursor(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    setSelectedDay(today);
    setAgendaDay(null);
  };
  const weekdays = useMemo(() => Array.from({ length: 7 }, (_, index) => weekdayFormatter.format(new Date(2024, 0, 1 + index))), [weekdayFormatter]);

  return (
    <div className="integration-page calendar-interface">
      <h1 className="visually-hidden">{database.title}</h1>
      <div className="calendar-toolbar">
        <div className="calendar-navigation">
          <button type="button" className="today-button" onClick={resetToday}>{t("calendarView.today")}</button>
          <button type="button" className="calendar-nav-button" aria-label={t("calendarView.previous")} onClick={() => moveMonth(-1)}>‹</button>
          <button type="button" className="calendar-nav-button" aria-label={t("calendarView.next")} onClick={() => moveMonth(1)}>›</button>
          <h2>{monthLabel}</h2>
        </div>
        <div className="integration-actions"><div className="calendar-mode-tabs" role="tablist" aria-label={t("calendarView.viewLabel")}>
          {(["month", "agenda"] as const).map((view) => (
            <button type="button" role="tab" aria-selected={mode === view} className={mode === view ? "active" : ""} key={view} onClick={() => { setMode(view); setAgendaDay(null); }}>{t(`calendarView.${view}`)}</button>
          ))}
        </div>
        <button type="button" className="primary-button" onClick={addEvent}>＋ {t("calendarView.newEvent")}</button></div>
      </div>

      {mode === "month" ? (
        <><div className="calendar-grid" role="grid" aria-label={monthLabel}>
          {weekdays.map((day) => <div className="calendar-weekday" role="columnheader" key={day}>{day}</div>)}
          {monthDays.map(({ date, key, inMonth }) => {
            const dayRows = eventsByDay.get(key) || [];
            return (
              <div className={`calendar-day ${inMonth ? "" : "outside-month"} ${key === today ? "is-today" : ""}`} role="gridcell" key={key}>
                <button type="button" className="calendar-day-number" aria-label={fullDateFormatter.format(date)} aria-pressed={selectedDay === key} aria-current={key === today ? "date" : undefined} onClick={() => setSelectedDay(key)}>{date.getDate()}{key === today && <span>{t("calendarView.todayShort")}</span>}</button>
                <span className="mobile-event-count" aria-hidden="true">{dayRows.length > 0 ? dayRows.length : ""}</span>
                <div className="calendar-day-events">
                  {dayRows.slice(0, 3).map((row) => <button type="button" className="calendar-event" key={row.id} onClick={() => onOpenRow(row.id)}><i style={{ background: calendarColor(valueFor(row, GOOGLE_CALENDAR_PROPERTY_IDS.calendar)) }} /><span>{formatCalendarTime(row, t("calendarView.allDay"), timeFormatter)}</span><strong>{row.title || t("database.untitledRow")}</strong></button>)}
                  {dayRows.length > 3 && <button type="button" className="calendar-more" onClick={() => { setAgendaDay(key); setSelectedDay(key); setMode("agenda"); }}>+{dayRows.length - 3} {t("calendarView.more")}</button>}
                </div>
              </div>
            );
          })}
        </div>
        <section className="calendar-day-agenda" aria-label={t("calendarView.agenda")}>
          <h2>{selectedDateFormatter.format(new Date(`${selectedDay}T12:00:00`))}</h2>
          <CalendarAgenda rows={eventsByDay.get(selectedDay) || []} onOpenRow={onOpenRow} />
        </section></>
      ) : (
        <>
          {agendaDay && <button type="button" className="back-link" onClick={() => setAgendaDay(null)}>← {monthLabel}</button>}
          <CalendarAgenda rows={agendaRows} onOpenRow={onOpenRow} />
        </>
      )}
    </div>
  );
}
