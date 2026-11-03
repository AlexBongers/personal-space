"use client";

import { useState } from "react";
import { ChoiceChips, EditorDialog } from "./EditorDialog";
import { canSaveEvent, durationMinutes, eventDraft, isReadOnlyEvent, withDuration, withStart, type EventDraft } from "./editor-model.ts";
import { useLanguage } from "./i18n";
import type { Row } from "./types";
import { useWritableCalendars } from "./useWritableCalendars";

type EventDialogProps = {
  /** The appointment to edit, or undefined for a new one on `day`. */
  row?: Row;
  day: string;
  onSave: (draft: EventDraft) => void;
  onClose: () => void;
  onDelete?: () => void;
  onOpenDetails?: () => void;
};

const DURATIONS = [30, 60, 90, 120];
const RECURRENCE = [
  { value: "", label: "calendarEditor.recurrenceNone" },
  { value: "RRULE:FREQ=DAILY", label: "calendarEditor.recurrenceDaily" },
  { value: "RRULE:FREQ=WEEKLY", label: "calendarEditor.recurrenceWeekly" },
  { value: "RRULE:FREQ=MONTHLY", label: "calendarEditor.recurrenceMonthly" },
  { value: "RRULE:FREQ=YEARLY", label: "calendarEditor.recurrenceYearly" },
];

export function EventDialog({ row, day, onSave, onClose, onDelete, onOpenDetails }: EventDialogProps) {
  const { t } = useLanguage();
  const [draft, setDraft] = useState(() => eventDraft(row, day));
  const { calendars, state } = useWritableCalendars();
  const change = (patch: Partial<EventDraft>) => setDraft((current) => ({ ...current, ...patch }));
  const minutes = durationMinutes(draft);
  const readOnly = row ? isReadOnlyEvent(row) : false;
  const valid = canSaveEvent(draft) && !readOnly;
  const endBeforeStart = !readOnly && draft.title.trim() !== "" && !valid && !draft.allDay && draft.startTime !== "" && draft.endTime !== "";
  const selectedCalendar = draft.calendarId || calendars.find((calendar) => calendar.title === draft.calendar)?.id || "";
  const calendarChoices = draft.calendarId && !calendars.some((calendar) => calendar.id === draft.calendarId)
    ? [{ id: draft.calendarId, title: draft.calendar || draft.calendarId, primary: false }, ...calendars]
    : calendars;
  const durationLabel = (value: number) => value < 60 ? t("editor.minutes", { count: value }) : t("editor.hours", { count: String(value / 60).replace(".", ",") });

  return (
    <EditorDialog
      title={row ? t("editor.editEvent") : t("editor.newEvent")}
      canSave={valid}
      onSave={() => onSave(draft)}
      onClose={onClose}
      onDelete={readOnly ? undefined : onDelete}
      onOpenDetails={onOpenDetails}
    >
      {readOnly && <p className="editor-notice">{t("editor.readOnlyEvent", { calendar: draft.calendar })}</p>}
      <div className="editor-title-row">
        <input className="editor-title-input" data-autofocus readOnly={readOnly} value={draft.title} placeholder={t("editor.eventTitlePlaceholder")} aria-label={t("calendarEditor.titleLabel")} onChange={(event) => change({ title: event.target.value })} />
      </div>

      <div className="editor-when">
        <label className="editor-field">
          <span className="editor-label">{t("editor.date")}</span>
          <input className="editor-input" type="date" value={draft.date} onChange={(event) => event.target.value && setDraft(withStart(draft, event.target.value, draft.startTime))} />
        </label>
        {draft.allDay ? (
          <label className="editor-field">
            <span className="editor-label">{t("editor.until")}</span>
            <input className="editor-input" type="date" value={draft.endDate} min={draft.date} onChange={(event) => change({ endDate: event.target.value })} />
          </label>
        ) : (
          <>
            <label className="editor-field">
              <span className="editor-label">{t("editor.from")}</span>
              <input className="editor-input" type="time" value={draft.startTime} onChange={(event) => event.target.value && setDraft(withStart(draft, draft.date, event.target.value))} />
            </label>
            <label className="editor-field">
              <span className="editor-label">{t("editor.to")}</span>
              <input className="editor-input" type="time" value={draft.endTime} onChange={(event) => change({ endTime: event.target.value })} />
            </label>
          </>
        )}
      </div>
      <div className="editor-inline">
        <label className="editor-check"><input type="checkbox" checked={draft.allDay} onChange={(event) => change({ allDay: event.target.checked, endDate: event.target.checked ? draft.date : draft.endDate })} /> {t("editor.allDay")}</label>
        {!draft.allDay && (
          <ChoiceChips label={t("editor.duration")} value={String(minutes)} options={DURATIONS.map((value) => ({ value: String(value), label: durationLabel(value) }))} onChange={(value) => setDraft(withDuration(draft, Number(value)))} />
        )}
      </div>
      {endBeforeStart && <p className="editor-warning">{t("editor.endBeforeStart")}</p>}

      <div className="editor-columns">
        <label className="editor-field">
          <span className="editor-label">{t("editor.calendar")}</span>
          <select className="editor-input" value={selectedCalendar} disabled={state !== "ready"} onChange={(event) => {
            const chosen = calendarChoices.find((calendar) => calendar.id === event.target.value);
            change({ calendarId: chosen?.id || "", calendar: chosen?.title || "" });
          }}>
            <option value="">{state === "loading" ? t("calendarEditor.calendarLoading") : t("editor.firstCalendar")}</option>
            {calendarChoices.map((calendar) => <option value={calendar.id} key={calendar.id}>{calendar.title}</option>)}
          </select>
        </label>
        <label className="editor-field">
          <span className="editor-label">{t("calendarEditor.recurrence")}</span>
          <select className="editor-input" value={draft.recurrence} onChange={(event) => change({ recurrence: event.target.value })}>
            {RECURRENCE.map((option) => <option value={option.value} key={option.value}>{t(option.label)}</option>)}
            {draft.recurrence && !RECURRENCE.some((option) => option.value === draft.recurrence) && <option value={draft.recurrence}>{t("calendarEditor.recurrenceCustom")}</option>}
          </select>
        </label>
      </div>

      <label className="editor-field">
        <span className="editor-label">{t("calendarEditor.location")}</span>
        <input className="editor-input" value={draft.location} placeholder={t("calendarEditor.locationPlaceholder")} onChange={(event) => change({ location: event.target.value })} />
      </label>
      <label className="editor-field">
        <span className="editor-label">{t("calendarEditor.attendees")}</span>
        <input className="editor-input" type="email" multiple value={draft.attendees} placeholder={t("calendarEditor.attendeesPlaceholder")} onChange={(event) => change({ attendees: event.target.value })} />
      </label>
      <label className="editor-field">
        <span className="editor-label">{t("editor.notes")}</span>
        <textarea className="editor-input editor-notes" rows={3} value={draft.notes} placeholder={t("editor.notesPlaceholder")} onChange={(event) => change({ notes: event.target.value })} />
      </label>
    </EditorDialog>
  );
}
