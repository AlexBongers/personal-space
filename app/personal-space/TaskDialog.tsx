"use client";

import { useMemo, useState } from "react";
import { ChoiceChips, EditorDialog } from "./EditorDialog";
import { canSaveTask, dueShortcuts, reminderFromInput, reminderInput, reminderShortcuts, taskDraft, type TaskDraft } from "./editor-model.ts";
import { useLanguage } from "./i18n";
import type { Row } from "./types";

type TaskDialogProps = {
  /** The task to edit, or undefined for a new one. */
  row?: Row;
  lists: string[];
  defaultList?: string;
  onSave: (draft: TaskDraft) => void;
  onClose: () => void;
  onDelete?: () => void;
  onOpenDetails?: () => void;
};

const NEW_LIST = "\u0000new";

export function TaskDialog({ row, lists, defaultList = "", onSave, onClose, onDelete, onOpenDetails }: TaskDialogProps) {
  const { language, t } = useLanguage();
  const [draft, setDraft] = useState(() => taskDraft(row, { list: defaultList }));
  const [newList, setNewList] = useState(false);
  const change = (patch: Partial<TaskDraft>) => setDraft((current) => ({ ...current, ...patch }));
  const shortcuts = useMemo(() => dueShortcuts(), []);
  const reminders = useMemo(() => reminderShortcuts(), []);
  const reminderChoice = draft.reminder ? reminders.find((entry) => entry.value === draft.reminder)?.key ?? "time" : "none";
  const reminderLabel = draft.reminder && reminderChoice === "time"
    ? new Intl.DateTimeFormat(language === "nl" ? "nl-NL" : "en-US", { timeZone: "Europe/Amsterdam", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(draft.reminder))
    : t("editor.reminder.pick");
  const dueChoice = draft.due ? shortcuts.find((entry) => entry.value === draft.due)?.key ?? "date" : "none";
  const dateLabel = useMemo(() => draft.due && dueChoice === "date"
    ? new Intl.DateTimeFormat(language === "nl" ? "nl-NL" : "en-US", { weekday: "short", day: "numeric", month: "short" }).format(new Date(`${draft.due}T12:00:00`))
    : t("editor.due.pick"), [draft.due, dueChoice, language, t]);
  const listOptions = [...new Set([...lists, ...(draft.list && !lists.includes(draft.list) ? [draft.list] : [])])];

  return (
    <EditorDialog
      title={row ? t("editor.editTask") : t("editor.newTask")}
      canSave={canSaveTask(draft)}
      onSave={() => onSave(draft)}
      onClose={onClose}
      onDelete={onDelete}
      onOpenDetails={onOpenDetails}
    >
      <div className="editor-title-row">
        {row && (
          <button type="button" className={`task-check ${draft.done ? "is-checked" : ""}`} aria-pressed={draft.done} aria-label={t("editor.markDone")} onClick={() => change({ done: !draft.done })}>{draft.done ? "✓" : ""}</button>
        )}
        <input className="editor-title-input" data-autofocus value={draft.title} placeholder={t("editor.taskTitlePlaceholder")} aria-label={t("taskEditor.titleLabel")} onChange={(event) => change({ title: event.target.value })} />
      </div>

      <div className="editor-field">
        <span className="editor-label">{t("editor.list")}</span>
        {newList ? (
          <input className="editor-input" autoFocus value={draft.list} placeholder={t("editor.newListPlaceholder")} aria-label={t("editor.newList")} onChange={(event) => change({ list: event.target.value })} onBlur={() => { if (!draft.list.trim()) setNewList(false); }} />
        ) : (
          <ChoiceChips
            label={t("editor.list")}
            value={draft.list}
            options={[
              ...(listOptions.length ? [] : [{ value: "", label: t("editor.defaultList") }]),
              ...listOptions.map((list) => ({ value: list, label: list })),
              { value: NEW_LIST, label: `+ ${t("editor.newList")}` },
            ]}
            onChange={(value) => { if (value === NEW_LIST) { setNewList(true); change({ list: "" }); } else change({ list: value }); }}
          />
        )}
      </div>

      <div className="editor-field">
        <span className="editor-label">{t("editor.due")}</span>
        <div className="choice-chips">
          {shortcuts.map((entry) => (
            <button type="button" className={dueChoice === entry.key ? "is-selected" : ""} aria-pressed={dueChoice === entry.key} key={entry.key} onClick={() => change({ due: entry.value })}>{t(`editor.due.${entry.key}`)}</button>
          ))}
          <label className={`chip-date ${dueChoice === "date" ? "is-selected" : ""}`}>
            <span>{dateLabel}</span>
            <input type="date" value={draft.due} aria-label={t("editor.due.pick")} onChange={(event) => change({ due: event.target.value })} />
          </label>
          <button type="button" className={dueChoice === "none" ? "is-selected" : ""} aria-pressed={dueChoice === "none"} onClick={() => change({ due: "" })}>{t("editor.due.none")}</button>
        </div>
      </div>

      <div className="editor-field">
        <span className="editor-label">{t("editor.reminder")}</span>
        <div className="choice-chips">
          {reminders.map((entry) => (
            <button type="button" className={reminderChoice === entry.key ? "is-selected" : ""} aria-pressed={reminderChoice === entry.key} key={entry.key} onClick={() => change({ reminder: entry.value })}>{t(`editor.reminder.${entry.key}`)}</button>
          ))}
          <label className={`chip-date ${reminderChoice === "time" ? "is-selected" : ""}`}>
            <span>{reminderLabel}</span>
            <input type="datetime-local" value={reminderInput(draft.reminder)} aria-label={t("editor.reminder.pick")} onChange={(event) => change({ reminder: reminderFromInput(event.target.value) })} />
          </label>
          <button type="button" className={reminderChoice === "none" ? "is-selected" : ""} aria-pressed={reminderChoice === "none"} onClick={() => change({ reminder: "" })}>{t("editor.due.none")}</button>
        </div>
        <span className="editor-hint">{t("editor.reminderHint")}</span>
      </div>

      <label className="editor-field">
        <span className="editor-label">{t("editor.notes")}</span>
        <textarea className="editor-input editor-notes" rows={3} value={draft.notes} placeholder={t("editor.notesPlaceholder")} onChange={(event) => change({ notes: event.target.value })} />
      </label>
    </EditorDialog>
  );
}
