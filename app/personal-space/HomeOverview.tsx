"use client";

import { getValue, GOOGLE_TASKS_DATABASE_ID, GOOGLE_TASK_PROPERTY_IDS, isDatabase, valueText } from "./model";
import { useLanguage } from "./i18n";
import { SlashdotFeed } from "./SlashdotFeed";
import type { Item } from "./types";

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

export function HomeOverview({ items, onOpen }: HomeOverviewProps) {
  const { language, t } = useLanguage();
  const taskCandidate = items.find((item) => item.id === GOOGLE_TASKS_DATABASE_ID);
  const taskDatabase = isDatabase(taskCandidate) ? taskCandidate : undefined;
  const todayDate = new Date();
  const todayKey = localDateKey(todayDate);
  const dueTasks = (taskDatabase?.rows || [])
    .map((row) => ({ row, due: valueText(getValue(row, GOOGLE_TASK_PROPERTY_IDS.due)) }))
    .filter((entry) => entry.due && getValue(entry.row, GOOGLE_TASK_PROPERTY_IDS.status) !== "Done")
    .sort((a, b) => a.due.localeCompare(b.due))
    .slice(0, 6);
  return (
    <section className="home-overview" aria-label={t("overview.aria")}>
      {dueTasks.length > 0 && (
        <section className="due-panel" aria-labelledby="due-tasks-heading">
          <div className="due-heading">
            <h2 id="due-tasks-heading">{t("overview.dueTasks")}</h2>
            <button type="button" className="small-button" onClick={() => onOpen(GOOGLE_TASKS_DATABASE_ID)}>{t("overview.openTasks")}</button>
          </div>
          <div className="due-list">
            {dueTasks.map(({ row, due }) => {
              const overdue = due < todayKey;
              const dueLabel = overdue
                ? `${t("overview.overdue")} · ${formatDueDate(due, language)}`
                : due === todayKey ? t("overview.today") : formatDueDate(due, language);
              return (
                <button type="button" className={`due-row ${overdue ? "overdue" : ""}`} key={row.id} onClick={() => onOpen(GOOGLE_TASKS_DATABASE_ID, row.id)}>
                  <span className="due-marker" aria-hidden="true" />
                  <span className="due-copy"><strong>{row.title}</strong><time dateTime={due}>{dueLabel}</time></span>
                  <span className="due-arrow">↗</span>
                </button>
              );
            })}
          </div>
        </section>
      )}
      <div className="landing-grid single-column">
        <SlashdotFeed />
      </div>
    </section>
  );
}
