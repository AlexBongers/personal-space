"use client";

import { useDeferredValue, useEffect, useMemo, useState, type DragEvent } from "react";
import { canMoveEvent, canMoveTask, eventValues, moveEventValues, taskListNames, taskReminder, taskValues, type EventDraft } from "./editor-model.ts";
import { EventDialog } from "./EventDialog";
import { TaskDialog } from "./TaskDialog";
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
  /** A task or appointment to open in the editor right away, for example from a notification. */
  initialRowId?: string | null;
  /** Opens the full page with every field, the page content and the sync details. */
  onOpenDetails: (rowId: string) => void;
  onUpdateCell: (rowId: string, propertyId: string, value: CellValue) => void;
  /** Creates a row (rowId null) or updates its title and values; returns the row id. */
  onSaveRow: (rowId: string | null, title: string, values: Record<string, CellValue>) => string;
  onDeleteRow: (rowId: string, confirmation?: string) => boolean;
  /** Opens the Google connection and sync dialog. */
  onOpenSync?: () => void;
};

const TASK_DRAG = "application/x-personal-space-task";
const FOLDED_LISTS_KEY = "personal-space-folded-task-lists";
const EVENT_DRAG = "application/x-personal-space-event";

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

function TaskQuickAdd({ list, onAdd }: { list: string; onAdd: (title: string) => void }) {
  const { t } = useLanguage();
  const [title, setTitle] = useState("");
  return (
    <form className="task-quick-add" onSubmit={(event) => { event.preventDefault(); if (title.trim()) { onAdd(title.trim()); setTitle(""); } }}>
      <span aria-hidden="true">＋</span>
      <input value={title} placeholder={t("editor.quickAdd")} aria-label={`${t("editor.quickAdd")}: ${list}`} onChange={(event) => setTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") setTitle(""); }} />
    </form>
  );
}

export function GoogleTasksInterface({ database, rows, initialRowId, onOpenDetails, onUpdateCell, onSaveRow, onDeleteRow, onOpenSync }: IntegrationViewProps) {
  const { language, t } = useLanguage();
  const [statusFilter, setStatusFilter] = useState<"open" | "all" | "done">("open");
  const [query, setQuery] = useState("");
  const [editor, setEditor] = useState<{ rowId: string | null; list: string } | null>(() => initialRowId ? { rowId: initialRowId, list: "" } : null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropList, setDropList] = useState<string | null>(null);
  // Folded lists show only their heading; remembered on this device.
  const [foldedLists, setFoldedLists] = useState<string[]>([]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try { setFoldedLists(JSON.parse(window.localStorage.getItem(FOLDED_LISTS_KEY) || "[]")); } catch { /* All open by default. */ }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  const toggleList = (list: string) => setFoldedLists((current) => {
    const next = current.includes(list) ? current.filter((entry) => entry !== list) : [...current, list];
    try { window.localStorage.setItem(FOLDED_LISTS_KEY, JSON.stringify(next)); } catch { /* Lasts for this session. */ }
    return next;
  });
  const deferredQuery = useDeferredValue(query);
  const dueFormatter = useMemo(() => new Intl.DateTimeFormat(language === "nl" ? "nl-NL" : "en-US", { day: "numeric", month: "short", year: "numeric" }), [language]);
  const reminderFormatter = useMemo(() => new Intl.DateTimeFormat(language === "nl" ? "nl-NL" : "en-US", { timeZone: CALENDAR_TIME_ZONE, weekday: "short", hour: "2-digit", minute: "2-digit" }), [language]);
  const liveRows = useMemo(() => database.rows.filter((row) => !row.trash), [database.rows]);
  const rowLists = useMemo(() => taskListNames(liveRows), [liveRows]);
  // Lists stay visible when their last task is dragged out: the Google lists, plus every list seen in this session.
  const [googleLists, setGoogleLists] = useState<string[]>([]);
  const [seenLists, setSeenLists] = useState<string[]>(rowLists);
  if (rowLists.some((list) => !seenLists.includes(list))) setSeenLists([...new Set([...seenLists, ...rowLists])]);
  useEffect(() => {
    let active = true;
    fetch("/api/google-tasks/status", { cache: "no-store" })
      .then((response) => response.json() as Promise<{ taskLists?: Array<{ title?: unknown }> }>)
      .then((status) => {
        if (active) setGoogleLists((status.taskLists || []).map((list) => typeof list.title === "string" ? list.title.trim() : "").filter(Boolean));
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);
  const lists = useMemo(() => [...new Set([...googleLists, ...seenLists])].sort((a, b) => a.localeCompare(b, language)), [googleLists, language, seenLists]);
  const counts = useMemo(() => ({
    all: rows.length,
    done: rows.filter(taskIsDone).length,
    open: rows.filter((row) => !taskIsDone(row)).length,
  }), [rows]);

  // Every list is shown, also when the filter leaves it empty, so a task can always be dragged to it.
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
    const groups = new Map<string, Row[]>(normalizedQuery ? [] : lists.map((list) => [list, []]));
    filtered.forEach((row) => {
      const list = valueFor(row, GOOGLE_TASK_PROPERTY_IDS.list);
      groups.set(list, [...(groups.get(list) || []), row]);
    });
    return [...groups.entries()].sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b, language)));
  }, [deferredQuery, language, lists, rows, statusFilter]);

  const editing = editor?.rowId ? liveRows.find((row) => row.id === editor.rowId) : undefined;
  const closeEditor = () => setEditor(null);

  const moveToList = (rowId: string, list: string) => {
    const row = liveRows.find((entry) => entry.id === rowId);
    if (row && valueFor(row, GOOGLE_TASK_PROPERTY_IDS.list) !== list && canMoveTask(row, liveRows)) onUpdateCell(rowId, GOOGLE_TASK_PROPERTY_IDS.list, list);
  };

  const dropHandlers = (list: string) => list === "" ? {} : {
    onDragOver: (event: DragEvent<HTMLElement>) => {
      if (!event.dataTransfer.types.includes(TASK_DRAG)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      setDropList(list);
    },
    onDragLeave: (event: DragEvent<HTMLElement>) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropList(null); },
    onDrop: (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      moveToList(event.dataTransfer.getData(TASK_DRAG), list);
      setDropList(null);
      setDragging(null);
    },
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
        {onOpenSync && <button type="button" className="small-button" onClick={onOpenSync}>{t("google.syncButton")}</button>}
        <button type="button" className="primary-button" onClick={() => setEditor({ rowId: null, list: lists[0] || "" })}>＋ {t("tasks.newTask")}</button></div>
      </div>

      <div className="task-groups">
        {groupedRows.map(([list, groupRows]) => (
          <section className={`task-group ${dropList === list ? "is-drop-target" : ""} ${foldedLists.includes(list) ? "is-folded" : ""}`} key={list || "none"} {...dropHandlers(list)}>
            <button type="button" className="task-group-heading" aria-expanded={!foldedLists.includes(list)} aria-label={t("tasks.collapseList", { title: list || t("tasks.noList") })} onClick={() => toggleList(list)}>
              <span className="task-group-chevron" aria-hidden="true">›</span><h2>{list || t("tasks.noList")}</h2><span>{groupRows.length}</span>
            </button>
            {!foldedLists.includes(list) && <>
            <div className="task-list">
              {groupRows.map((row) => {
                const done = taskIsDone(row);
                const due = taskDueKey(row);
                const notes = valueFor(row, GOOGLE_TASK_PROPERTY_IDS.notes);
                const movable = canMoveTask(row, liveRows);
                return (
                  <div
                    className={`task-item ${done ? "is-done" : ""} ${dragging === row.id ? "is-dragging" : ""}`}
                    key={row.id}
                    draggable={movable}
                    title={movable ? undefined : t("editor.cannotMove")}
                    onDragStart={(event) => { event.dataTransfer.setData(TASK_DRAG, row.id); event.dataTransfer.effectAllowed = "move"; setDragging(row.id); }}
                    onDragEnd={() => { setDragging(null); setDropList(null); }}
                  >
                    <button
                      type="button"
                      className="task-check"
                      aria-label={done ? t("tasks.markOpen", { title: row.title }) : t("tasks.markDone", { title: row.title })}
                      aria-pressed={done}
                      onClick={() => onUpdateCell(row.id, GOOGLE_TASK_PROPERTY_IDS.status, done ? "Open" : "Done")}
                    >{done ? "✓" : ""}</button>
                    <button type="button" className="task-main" onClick={() => setEditor({ rowId: row.id, list })}>
                      <strong>{row.title || t("database.untitledRow")}</strong>
                      <span className="task-detail-line">
                        {due && <time className={taskDueTone(due)} dateTime={due}>{formatTaskDue(due, dueFormatter)}</time>}
                        {taskReminder(row) && <span className="task-reminder-badge" title={t("editor.reminder")}>🔔 {reminderFormatter.format(new Date(taskReminder(row)))}</span>}
                        {notes && <span className="task-notes-preview">{notes}</span>}
                      </span>
                    </button>
                    <button type="button" className="task-delete" aria-label={`${t("database.deleteRowLabel")}: ${row.title}`} onClick={() => onDeleteRow(row.id, t("taskEditor.deleteConfirm"))}>×</button>
                  </div>
                );
              })}
              {!groupRows.length && <p className="task-group-empty">{dragging ? t("editor.dropHere") : t("editor.emptyList")}</p>}
            </div>
            {list !== "" && !deferredQuery && (
              <TaskQuickAdd list={list} onAdd={(title) => onSaveRow(null, title, taskValues({ title, list, due: "", notes: "", done: false, reminder: "" }))} />
            )}
            </>}
          </section>
        ))}
      </div>
      {groupedRows.length === 0 && <div className="integration-empty"><span className="empty-icon">✓</span><strong>{t("tasks.emptyTitle")}</strong><p>{query ? t("tasks.emptySearch") : t("tasks.emptyHint")}</p></div>}

      {editor && (editor.rowId === null || editing) && (
        <TaskDialog
          row={editing}
          lists={lists}
          defaultList={editor.list}
          onClose={closeEditor}
          onSave={(draft) => { onSaveRow(editing?.id ?? null, draft.title.trim(), taskValues(draft)); closeEditor(); }}
          onDelete={editing ? () => { if (onDeleteRow(editing.id, t("taskEditor.deleteConfirm"))) closeEditor(); } : undefined}
          onOpenDetails={editing ? () => { closeEditor(); onOpenDetails(editing.id); } : undefined}
        />
      )}
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

export function GoogleCalendarInterface({ database, rows, initialRowId, onOpenDetails, onSaveRow, onDeleteRow, onOpenSync }: IntegrationViewProps) {
  const { language, t } = useLanguage();
  const [editor, setEditor] = useState<{ rowId: string | null; day: string } | null>(() => initialRowId ? { rowId: initialRowId, day: calendarTodayKey(new Date()) } : null);
  const [dropDay, setDropDay] = useState<string | null>(null);
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

  const addEvent = (day = selectedDay) => setEditor({ rowId: null, day });
  const openEvent = (rowId: string) => setEditor({ rowId, day: selectedDay });
  const editing = editor?.rowId ? rows.find((row) => row.id === editor.rowId) : undefined;
  const closeEditor = () => setEditor(null);
  const saveEvent = (draft: EventDraft) => {
    onSaveRow(editing?.id ?? null, draft.title.trim(), { ...(editing ? {} : { [GOOGLE_CALENDAR_PROPERTY_IDS.status]: "Confirmed" }), ...eventValues(draft) });
    closeEditor();
  };

  // Appointments can be dragged to another day; they keep their times and length.
  const dropHandlers = (key: string) => ({
    onDragOver: (event: DragEvent<HTMLElement>) => {
      if (!event.dataTransfer.types.includes(EVENT_DRAG)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      setDropDay(key);
    },
    onDragLeave: (event: DragEvent<HTMLElement>) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropDay(null); },
    onDrop: (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      setDropDay(null);
      const { id, from } = JSON.parse(event.dataTransfer.getData(EVENT_DRAG) || "{}") as { id?: string; from?: string };
      const row = rows.find((entry) => entry.id === id);
      if (row && from && from !== key && canMoveEvent(row)) onSaveRow(row.id, row.title, moveEventValues(row, from, key));
    },
  });

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
    <button
      type="button"
      className={"calendar-event " + (event.startDateKey < dayKey ? "is-continuation" : "")}
      key={event.row.id}
      draggable={canMoveEvent(event.row)}
      onDragStart={(dragEvent) => { dragEvent.dataTransfer.setData(EVENT_DRAG, JSON.stringify({ id: event.row.id, from: dayKey })); dragEvent.dataTransfer.effectAllowed = "move"; }}
      onClick={() => openEvent(event.row.id)}
    >
      <i style={{ background: calendarColor(valueText(getValue(event.row, GOOGLE_CALENDAR_PROPERTY_IDS.calendar))) }} />
      <span>{formatEventTime(event, dayKey, locale, t("calendarView.allDay"), t("calendarView.continues"))}</span>
      <strong>{event.row.title || t("database.untitledRow")}</strong>
    </button>
  );

  const renderMonthDay = (key: string) => {
    const dayEvents = eventsByDay.get(key) || [];
    const date = dateFromKey(key);
    return <div className={"calendar-day " + (key.slice(0, 7) === cursorMonth ? "" : "outside-month") + " " + (key === today ? "is-today" : "") + " " + (dropDay === key ? "is-drop-target" : "")} role="gridcell" key={key} {...dropHandlers(key)}
      onDoubleClick={(event) => { if (!(event.target as HTMLElement).closest("button")) addEvent(key); }}>
      <button type="button" className="calendar-add" aria-label={t("editor.addEventOn", { date: fullDateFormatter.format(date) })} onClick={() => addEvent(key)}>+</button>
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
        {onOpenSync && <button type="button" className="small-button" onClick={onOpenSync}>{t("google.syncButton")}</button>}
        <button type="button" className="primary-button" onClick={() => addEvent()}>＋ {t("calendarView.newEvent")}</button></div>
      </div>

      {mode === "month" && <><div className="calendar-grid" role="grid" aria-label={monthLabel}>
        {weekdays.map((day) => <div className="calendar-weekday" role="columnheader" key={day}>{day}</div>)}
        {monthDays.map(renderMonthDay)}
      </div>
      <section className="calendar-day-agenda" aria-label={t("calendarView.agenda")}>
        <h2>{selectedDateFormatter.format(dateFromKey(selectedDay))}</h2>
        <CalendarAgenda events={eventsByDay.get(selectedDay) || []} dayKey={selectedDay} onOpenRow={openEvent} />
      </section></>}

      {mode === "week" && <section className="calendar-week-view" aria-label={weekLabel}>
        {weekDays.map((key) => {
          const dayEvents = eventsByDay.get(key) || [];
          return <article className={"calendar-week-day " + (key === today ? "is-today" : "") + " " + (dropDay === key ? "is-drop-target" : "")} key={key} {...dropHandlers(key)}>
            <button type="button" className="calendar-add" aria-label={t("editor.addEventOn", { date: fullDateFormatter.format(dateFromKey(key)) })} onClick={() => addEvent(key)}>+</button>
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
        <CalendarAgenda events={agendaEvents} dayKey={agendaDay || undefined} onOpenRow={openEvent} />
      </section>}

      {editor && (editor.rowId === null || editing) && (
        <EventDialog
          row={editing}
          day={editor.day}
          onClose={closeEditor}
          onSave={saveEvent}
          onDelete={editing ? () => { if (onDeleteRow(editing.id, t("calendarEditor.deleteConfirm"))) closeEditor(); } : undefined}
          onOpenDetails={editing ? () => { closeEditor(); onOpenDetails(editing.id); } : undefined}
        />
      )}
    </div>
  );
}
