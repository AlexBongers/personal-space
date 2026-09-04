"use client";

import { useMemo } from "react";
import { getValue, GOOGLE_TASKS_DATABASE_ID, GOOGLE_TASK_PROPERTY_IDS, isDatabase, valueText } from "./model";
import { useLanguage } from "./i18n";
import { SlashdotFeed } from "./SlashdotFeed";
import { GmailInbox } from "./GmailInbox";
import { InterfaceIcon } from "./InterfaceIcon";
import type { Item, Row } from "./types";

type HomeOverviewProps = {
  items: Item[];
  onOpen: (id: string, rowId?: string) => void;
};

const localDateKey = (date: Date) => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");

const formatDueDate = (value: string, language: "en" | "nl") => {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(language === "nl" ? "nl-NL" : "en-US", { day: "numeric", month: "short" }).format(date);
};

const taskIsDone = (row: Row) => ["done", "completed", "complete"].includes(valueText(getValue(row, GOOGLE_TASK_PROPERTY_IDS.status)).trim().toLowerCase());
const taskDueKey = (row: Row) => valueText(getValue(row, GOOGLE_TASK_PROPERTY_IDS.due)).trim().slice(0, 10);

type HomeTasksPanelProps = {
  rows: Row[];
  openCount: number;
  dueCount: number;
  todayKey: string;
  onOpen: (rowId?: string) => void;
};

function HomeTasksPanel({ rows, openCount, dueCount, todayKey, onOpen }: HomeTasksPanelProps) {
  const { language, t } = useLanguage();
  return (
    <section className="home-tasks-panel" aria-labelledby="home-tasks-heading">
      <div className="home-tasks-heading">
        <div>
          <h2 id="home-tasks-heading"><InterfaceIcon name="tasks" />{t("top.googleTasks")}</h2>
          <p className="home-tasks-summary">{t("tasks.summary", { open: openCount, due: dueCount })}</p>
        </div>
        <button type="button" className="small-button" onClick={() => onOpen()}>{t("overview.openTasks")}</button>
      </div>
      {rows.length > 0 ? (
        <ol className="home-task-list">
          {rows.map((row) => {
            const due = taskDueKey(row);
            const list = valueText(getValue(row, GOOGLE_TASK_PROPERTY_IDS.list)).trim() || t("tasks.noList");
            const dueLabel = due
              ? due === todayKey
                ? t("overview.today")
                : due < todayKey
                  ? `${t("overview.overdue")} · ${formatDueDate(due, language)}`
                  : formatDueDate(due, language)
              : "";
            return (
              <li key={row.id}>
                <button type="button" className="home-task-row" onClick={() => onOpen(row.id)}>
                  <span className={`home-task-check ${due && due < todayKey ? "overdue" : ""}`} aria-hidden="true" />
                  <span className="home-task-copy">
                    <span className="home-task-title">{row.title || t("database.untitledRow")}</span>
                    <span className={`home-task-meta ${due === todayKey ? "today" : due && due < todayKey ? "overdue" : ""}`}>{list}{dueLabel ? ` · ${dueLabel}` : ""}</span>
                  </span>
                  <span className="home-task-arrow" aria-hidden="true">→</span>
                </button>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="home-tasks-empty">{t("tasks.emptyHint")}</p>
      )}
    </section>
  );
}

export function HomeOverview({ items, onOpen }: HomeOverviewProps) {
  const { language, t } = useLanguage();
  const taskCandidate = items.find((item) => item.id === GOOGLE_TASKS_DATABASE_ID);
  const taskDatabase = isDatabase(taskCandidate) ? taskCandidate : undefined;
  const todayKey = localDateKey(new Date());
  const taskSummary = useMemo(() => {
    const openRows = (taskDatabase?.rows || [])
      .filter((row) => !taskIsDone(row))
      .sort((a, b) => (taskDueKey(a) || "9999-12-31").localeCompare(taskDueKey(b) || "9999-12-31") || a.title.localeCompare(b.title, language));
    return {
      openRows,
      previewRows: openRows.slice(0, 6),
      dueCount: openRows.filter((row) => {
        const due = taskDueKey(row);
        return due !== "" && due <= todayKey;
      }).length,
    };
  }, [language, taskDatabase, todayKey]);
  return (
    <section className="home-overview" aria-label={t("overview.aria")}>
      <div className="home-dashboard">
        <div className="home-priority-rail">
          <GmailInbox compact onOpenInbox={() => onOpen("gmail")} />
          <HomeTasksPanel rows={taskSummary.previewRows} openCount={taskSummary.openRows.length} dueCount={taskSummary.dueCount} todayKey={todayKey} onOpen={(rowId) => onOpen(GOOGLE_TASKS_DATABASE_ID, rowId)} />
        </div>
        <div className="home-news-grid"><SlashdotFeed /><SlashdotFeed source="tweakers" /></div>
      </div>
    </section>
  );
}
