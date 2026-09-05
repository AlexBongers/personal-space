"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BlockEditor } from "./BlockEditor";
import { GoogleCalendarInterface, GoogleTasksInterface } from "./IntegrationDatabaseViews";
import { useLanguage } from "./i18n";
import {
  createBlock,
  createOption,
  defaultFilterOperator,
  emptyView,
  GOOGLE_CALENDAR_DATABASE_ID,
  GOOGLE_CALENDAR_DEFAULT_ATTENDEE,
  GOOGLE_CALENDAR_PROPERTY_IDS,
  GOOGLE_TASKS_DATABASE_ID,
  GOOGLE_TASK_PROPERTY_IDS,
  getValue,
  matchesFilter,
  optionForValue,
  palette,
  propertyLabels,
  uid,
  valueText,
} from "./model";
import type {
  CellValue,
  Database,
  Filter,
  FilterOperator,
  Property,
  PropertyType,
  Row,
  ViewMode,
  ViewSettings,
} from "./types";

type DatabaseViewProps = {
  database: Database;
  onUpdate: (database: Database) => void;
  initialRowId?: string | null;
};

function ClickTooltip({ label, text }: { label: string; text: string }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <span className="click-tooltip" ref={containerRef}>
      <button
        type="button"
        className="tooltip-trigger"
        aria-label={label}
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
      >
        ?
      </button>
      {open && <span className="click-tooltip-content" role="tooltip">{text}</span>}
    </span>
  );
}

function googleTaskHelp(propertyId: string, t: (key: string) => string) {
  const helpKeys: Partial<Record<string, string>> = {
    [GOOGLE_TASK_PROPERTY_IDS.status]: "database.googleStatusHelp",
    [GOOGLE_TASK_PROPERTY_IDS.list]: "database.googleListHelp",
    [GOOGLE_TASK_PROPERTY_IDS.link]: "database.googleLinkHelp",
    [GOOGLE_TASK_PROPERTY_IDS.id]: "database.googleIdHelp",
    [GOOGLE_TASK_PROPERTY_IDS.parent]: "database.googleParentHelp",
    [GOOGLE_TASK_PROPERTY_IDS.position]: "database.googlePositionHelp",
  };
  const key = helpKeys[propertyId];
  return key ? t(key) : undefined;
}

function PropertyCell({ property, value, onChange }: { property: Property; value: CellValue; onChange: (value: CellValue) => void }) {
  const { t } = useLanguage();
  if (property.type === "checkbox") {
    return (
      <label className="cell-check">
        <input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} />
        <span>{value ? t("database.done") : t("database.no")}</span>
      </label>
    );
  }
  if (property.type === "select") {
    const normalizedValue = property.id === GOOGLE_TASK_PROPERTY_IDS.status && !value ? "Open" : value;
    const selected = optionForValue(property, normalizedValue);
    return (
      <span className="select-cell-shell">
        <i style={{ background: selected?.color || "var(--faint)" }} />
        <select className="cell-select" value={String(normalizedValue || "")} onChange={(event) => onChange(event.target.value)}>
          {property.id !== GOOGLE_TASK_PROPERTY_IDS.status && <option value="">{t("database.empty")}</option>}
          {(property.options || []).map((entry) => <option key={entry.id} value={entry.label}>{entry.label}</option>)}
        </select>
      </span>
    );
  }
  if (property.type === "multi-select") {
    const selectedValues = Array.isArray(value) ? value : [];
    return (
      <span className="multi-choice-cell" aria-label={t("database.values", { name: property.name })}>
        {(property.options || []).map((entry) => {
          const active = selectedValues.includes(entry.label);
          return (
            <button
              type="button"
              className={active ? "active" : ""}
              aria-pressed={active}
              key={entry.id}
              onClick={() => onChange(active ? selectedValues.filter((value) => value !== entry.label) : [...selectedValues, entry.label])}
            >
              <i style={{ background: entry.color }} />{entry.label}
            </button>
          );
        })}
      </span>
    );
  }
  return (
    <input
      className="cell-input"
      type={property.type === "number" ? "number" : property.type === "date" ? "date" : property.type === "url" ? "url" : "text"}
      value={valueText(value)}
      onChange={(event) => onChange(property.type === "number" ? (event.target.value ? Number(event.target.value) : null) : event.target.value)}
      placeholder={t(`properties.${property.type}`)}
    />
  );
}

function ValueDisplay({ property, value }: { property: Property; value: CellValue }) {
  const { t } = useLanguage();
  if (property.type === "checkbox") return <span className={`value-check ${value ? "done" : ""}`}>{value ? `✓ ${t("database.done")}` : `○ ${t("database.open")}`}</span>;
  if (property.type === "select") {
    const normalizedValue = property.id === GOOGLE_TASK_PROPERTY_IDS.status && !value ? "Open" : value;
    const selected = optionForValue(property, normalizedValue);
    return normalizedValue ? <span className="value-tag"><i style={{ background: selected?.color || "var(--faint)" }} />{String(normalizedValue)}</span> : <span className="value-empty">—</span>;
  }
  if (property.type === "multi-select" && Array.isArray(value)) {
    return (
      <span className="value-tags">
        {value.slice(0, 2).map((entry) => {
          const selected = optionForValue(property, entry);
          return <span className="value-tag" key={entry}><i style={{ background: selected?.color || "var(--faint)" }} />{entry}</span>;
        })}
      </span>
    );
  }
  return <span>{valueText(value) || "—"}</span>;
}

function PropertyManager({ database, onUpdate }: { database: Database; onUpdate: (database: Database) => void }) {
  const { t } = useLanguage();
  const [schemaOpen, setSchemaOpen] = useState(false);
  const addProperty = () => {
    const name = window.prompt(t("database.propertyName"), t("database.newProperty"));
    if (!name?.trim()) return;
    const typeInput = window.prompt(t("database.typePrompt"), "text")?.toLowerCase().trim() as PropertyType;
    const type = Object.keys(propertyLabels).includes(typeInput) ? typeInput : "text";
    const next: Property = { id: uid("property"), name: name.trim(), type };
    if (type === "select" || type === "multi-select") {
      next.options = [createOption(t("database.optionOne"), palette[0]), createOption(t("database.optionTwo"), palette[1])];
    }
    onUpdate({ ...database, properties: [...database.properties, next] });
  };

  const renameProperty = (property: Property) => {
    const name = window.prompt(t("database.renameProperty"), property.name);
    if (!name?.trim()) return;
    onUpdate({
      ...database,
      properties: database.properties.map((entry) => entry.id === property.id ? { ...entry, name: name.trim() } : entry),
    });
  };

  const removeProperty = (property: Property) => {
    if (!window.confirm(t("database.removeProperty", { name: property.name }))) return;
    const nextRows = database.rows.map((row) => {
      const values = { ...row.values };
      delete values[property.id];
      return { ...row, values };
    });
    const cleanView = (view: ViewSettings): ViewSettings => ({
      ...view,
      groupBy: view.groupBy === property.id ? "" : view.groupBy,
      sortBy: view.sortBy === property.id ? "" : view.sortBy,
      filters: view.filters.filter((filter) => filter.propertyId !== property.id),
    });
    const nextViews = database.views
      ? Object.fromEntries(
          Object.entries(database.views).map(([mode, view]) => [mode, view ? cleanView(view) : view]),
        ) as Partial<Record<ViewMode, ViewSettings>>
      : undefined;
    onUpdate({
      ...database,
      properties: database.properties.filter((entry) => entry.id !== property.id),
      rows: nextRows,
      view: cleanView(database.view),
      views: nextViews,
    });
  };

  const addOption = (property: Property) => {
    const label = window.prompt(t("database.optionLabel"), t("database.newOption"));
    if (!label?.trim()) return;
    const next = {
      ...property,
      options: [...(property.options || []), createOption(label.trim(), palette[(property.options || []).length % palette.length])],
    };
    onUpdate({
      ...database,
      properties: database.properties.map((entry) => entry.id === property.id ? next : entry),
    });
  };

  return (
    <section className="property-manager">
      <div className="property-manager-head">
        <div className="property-manager-title">
          <button
            className="collapse-button"
            aria-expanded={schemaOpen}
            aria-label={schemaOpen ? t("database.collapseProperties") : t("database.expandProperties")}
            onClick={() => setSchemaOpen((open) => !open)}
          >{schemaOpen ? "⌄" : "›"}</button>
          <div><span className="eyebrow">{t("database.schema")}</span><strong>{t("database.properties")}</strong></div>
        </div>
        <button className="small-button" onClick={addProperty}>＋ {t("database.addProperty")}</button>
      </div>
      {schemaOpen && (
        <div className="property-chips">
          {database.properties.map((property) => (
            <div className="property-chip" key={property.id}>
              <span className={`property-type-dot type-${property.type}`} />
              <span>{property.name}</span>
              <small>{t(`properties.${property.type}`)}</small>
              <button onClick={() => renameProperty(property)} aria-label={t("database.rename", { name: property.name })}>✎</button>
              {(property.type === "select" || property.type === "multi-select") && (
                <button onClick={() => addOption(property)} aria-label={t("database.addOption", { name: property.name })}>＋</button>
              )}
              <button className="danger-quiet" onClick={() => removeProperty(property)} aria-label={t("database.remove", { name: property.name })}>×</button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function RowPage({ database, row, onUpdate, onBack }: { database: Database; row: Row; onUpdate: (database: Database) => void; onBack: () => void }) {
  const { t } = useLanguage();
  const updateValue = (propertyId: string, value: CellValue) => onUpdate({
    ...database,
    rows: database.rows.map((entry) => entry.id === row.id ? { ...entry, values: { ...entry.values, [propertyId]: value } } : entry),
  });
  const updateBlocks = (blocks: Row["blocks"]) => onUpdate({
    ...database,
    rows: database.rows.map((entry) => entry.id === row.id ? { ...entry, blocks } : entry),
  });
  const updateTitle = (title: string) => onUpdate({
    ...database,
    rows: database.rows.map((entry) => entry.id === row.id ? { ...entry, title } : entry),
  });

  return (
    <div className="row-page">
      <button className="back-link" onClick={onBack}>← {t("database.backTo", { title: database.title })}</button>
      <div className="row-page-heading">
        <span className="page-kicker">{t("database.row")}</span>
        <input className="row-title-input" value={row.title} aria-label={t("database.rowTitle")} onChange={(event) => updateTitle(event.target.value)} />
      </div>
      <div className="row-properties">
        {database.properties.map((property) => (
          <div className="row-property" key={property.id}>
            <div className="row-property-label">
              <span>{property.name}</span>
              {database.id === GOOGLE_TASKS_DATABASE_ID && (() => {
                const help = googleTaskHelp(property.id, t);
                return help ? <ClickTooltip label={t("database.showHelp")} text={help} /> : null;
              })()}
            </div>
            <div className="row-property-control">
              {database.id === GOOGLE_TASKS_DATABASE_ID && property.id === GOOGLE_TASK_PROPERTY_IDS.notes ? (
                <textarea
                  className="cell-input row-notes-input"
                  rows={4}
                  value={valueText(getValue(row, property.id))}
                  aria-label={property.name}
                  placeholder={t("properties.text")}
                  onChange={(event) => updateValue(property.id, event.target.value)}
                />
              ) : (
                <PropertyCell property={property} value={getValue(row, property.id)} onChange={(value) => updateValue(property.id, value)} />
              )}
            </div>
          </div>
        ))}
      </div>
      <BlockEditor item={row} onChange={updateBlocks} />
    </div>
  );
}

const isUntitledRow = (title: string) => ["Untitled row", "Rij zonder titel", "Untitled task", "Naamloze taak", "Untitled event", "Naamloze afspraak"].includes(title);

function calendarDateParts(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return { date: value, time: "" };
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return {
      date: /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : "",
      time: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value) ? value.slice(11, 16) : "",
    };
  }
  const date = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
  return { date, time: value.includes("T") ? `${String(parsed.getHours()).padStart(2, "0")}:${String(parsed.getMinutes()).padStart(2, "0")}` : "" };
}

const calendarDateTimeInput = (value: string) => {
  const parts = calendarDateParts(value);
  return parts.date && parts.time ? `${parts.date}T${parts.time}` : "";
};

const calendarDateTimeValue = (value: string) => {
  if (!value) return "";
  const parsed = new Date(`${value}:00`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
};

const shiftCalendarDate = (value: string, amount: number) => {
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return "";
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
};

const safeExternalUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "";
  } catch {
    return "";
  }
};

function CalendarEventPage({ database, row, onUpdate, onBack, onDelete }: { database: Database; row: Row; onUpdate: (database: Database) => void; onBack: () => void; onDelete: () => boolean }) {
  const { t } = useLanguage();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [calendars, setCalendars] = useState<Array<{ id: string; title: string; primary: boolean }>>([]);
  const [calendarOptionsState, setCalendarOptionsState] = useState<"loading" | "ready" | "error">("loading");
  const valueFor = (propertyId: string) => valueText(getValue(row, propertyId));
  const allDay = Boolean(getValue(row, GOOGLE_CALENDAR_PROPERTY_IDS.allDay));
  const startValue = valueFor(GOOGLE_CALENDAR_PROPERTY_IDS.start);
  const endValue = valueFor(GOOGLE_CALENDAR_PROPERTY_IDS.end);
  const startParts = calendarDateParts(startValue);
  const endParts = calendarDateParts(endValue);
  const inclusiveEnd = allDay && endParts.date ? shiftCalendarDate(endParts.date, -1) : endParts.date;
  const statusProperty = database.properties.find((property) => property.id === GOOGLE_CALENDAR_PROPERTY_IDS.status);
  const link = safeExternalUrl(valueFor(GOOGLE_CALENDAR_PROPERTY_IDS.link));

  useEffect(() => {
    let active = true;
    fetch("/api/google-calendar/status", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json() as { calendars?: unknown };
        if (!response.ok || !Array.isArray(body.calendars)) throw new Error("calendar-options-unavailable");
        const nextCalendars = body.calendars.filter((entry): entry is { id: string; title: string; primary?: boolean } => (
          typeof entry === "object" && entry !== null && typeof entry.id === "string" && typeof entry.title === "string"
        )).map((calendar) => ({ id: calendar.id, title: calendar.title, primary: Boolean(calendar.primary) }));
        if (active) {
          setCalendars(nextCalendars);
          setCalendarOptionsState("ready");
        }
      })
      .catch(() => {
        if (active) setCalendarOptionsState("error");
      });
    return () => { active = false; };
  }, []);

  const currentCalendarId = valueFor(GOOGLE_CALENDAR_PROPERTY_IDS.calendarId);
  const currentCalendarName = valueFor(GOOGLE_CALENDAR_PROPERTY_IDS.calendar);
  const matchingCalendar = calendars.find((calendar) => calendar.title === currentCalendarName);
  const selectedCalendarId = currentCalendarId || matchingCalendar?.id || "";
  const visibleCalendars = currentCalendarId && !calendars.some((calendar) => calendar.id === currentCalendarId)
    ? [{ id: currentCalendarId, title: currentCalendarName || currentCalendarId, primary: false }, ...calendars]
    : calendars;

  const updateValues = (values: Record<string, CellValue>) => onUpdate({
    ...database,
    rows: database.rows.map((entry) => entry.id === row.id ? { ...entry, values: { ...entry.values, ...values } } : entry),
  });
  const updateValue = (propertyId: string, value: CellValue) => updateValues({ [propertyId]: value });
  const updateTitle = (title: string) => onUpdate({
    ...database,
    rows: database.rows.map((entry) => entry.id === row.id ? { ...entry, title } : entry),
  });
  const toggleAllDay = (nextAllDay: boolean) => {
    if (nextAllDay) {
      const date = startParts.date || new Date().toISOString().slice(0, 10);
      updateValues({
        [GOOGLE_CALENDAR_PROPERTY_IDS.allDay]: true,
        [GOOGLE_CALENDAR_PROPERTY_IDS.start]: date,
        [GOOGLE_CALENDAR_PROPERTY_IDS.end]: shiftCalendarDate(endParts.date || date, 1),
      });
      return;
    }
    const date = startParts.date || new Date().toISOString().slice(0, 10);
    const startTime = startParts.time || "09:00";
    const endDate = endParts.date || date;
    const endTime = endParts.time || "10:00";
    updateValues({
      [GOOGLE_CALENDAR_PROPERTY_IDS.allDay]: false,
      [GOOGLE_CALENDAR_PROPERTY_IDS.start]: calendarDateTimeValue(`${date}T${startTime}`),
      [GOOGLE_CALENDAR_PROPERTY_IDS.end]: calendarDateTimeValue(`${endDate}T${endTime}`),
    });
  };

  return (
    <div className="row-page calendar-event-page">
      <button className="back-link" onClick={onBack}>← {t("database.backTo", { title: database.title })}</button>
      <div className="row-page-heading calendar-event-heading">
        <span className="page-kicker">{t("calendarEditor.eyebrow")}</span>
        <input
          className="row-title-input"
          value={isUntitledRow(row.title) ? "" : row.title}
          placeholder={t("calendarEditor.titlePlaceholder")}
          aria-label={t("calendarEditor.titleLabel")}
          onChange={(event) => updateTitle(event.target.value)}
        />
        <div className="row-editor-actions">
          <button type="button" className="quiet-danger-button row-editor-delete" onClick={() => { if (onDelete()) onBack(); }}>
            × {t("calendarEditor.deleteEvent")}
          </button>
        </div>
      </div>

      <div className="calendar-event-editor">
        <section className="calendar-event-card">
          <div className="calendar-editor-section-heading">
            <span className="page-kicker">{t("calendarEditor.details")}</span>
            <h2>{t("calendarEditor.when")}</h2>
          </div>
          <div className="calendar-event-fields">
            <label className="calendar-all-day-toggle">
              <input type="checkbox" checked={allDay} onChange={(event) => toggleAllDay(event.target.checked)} />
              <span><strong>{t("calendarEditor.allDay")}</strong><small>{t("calendarEditor.allDayHint")}</small></span>
            </label>
            {allDay ? (
              <div className="calendar-event-datetime-grid">
                <label className="calendar-field">
                  <span className="calendar-field-label">{t("calendarEditor.starts")}</span>
                  <input type="date" value={startParts.date} aria-label={t("calendarEditor.starts")} onChange={(event) => updateValue(GOOGLE_CALENDAR_PROPERTY_IDS.start, event.target.value)} />
                </label>
                <label className="calendar-field">
                  <span className="calendar-field-label">{t("calendarEditor.ends")}</span>
                  <input type="date" value={inclusiveEnd} min={startParts.date || undefined} aria-label={t("calendarEditor.ends")} onChange={(event) => updateValue(GOOGLE_CALENDAR_PROPERTY_IDS.end, event.target.value ? shiftCalendarDate(event.target.value, 1) : "")} />
                </label>
              </div>
            ) : (
              <div className="calendar-event-datetime-grid">
                <label className="calendar-field">
                  <span className="calendar-field-label">{t("calendarEditor.starts")}</span>
                  <input type="datetime-local" value={calendarDateTimeInput(startValue)} aria-label={t("calendarEditor.starts")} onChange={(event) => updateValue(GOOGLE_CALENDAR_PROPERTY_IDS.start, calendarDateTimeValue(event.target.value))} />
                </label>
                <label className="calendar-field">
                  <span className="calendar-field-label">{t("calendarEditor.ends")}</span>
                  <input type="datetime-local" value={calendarDateTimeInput(endValue)} min={calendarDateTimeInput(startValue) || undefined} aria-label={t("calendarEditor.ends")} onChange={(event) => updateValue(GOOGLE_CALENDAR_PROPERTY_IDS.end, calendarDateTimeValue(event.target.value))} />
                </label>
              </div>
            )}
            <label className="calendar-field">
              <span className="calendar-field-label">{t("calendarEditor.location")}</span>
              <input className="calendar-editor-input" value={valueFor(GOOGLE_CALENDAR_PROPERTY_IDS.location)} placeholder={t("calendarEditor.locationPlaceholder")} aria-label={t("calendarEditor.location")} onChange={(event) => updateValue(GOOGLE_CALENDAR_PROPERTY_IDS.location, event.target.value)} />
            </label>
            <label className="calendar-field">
              <span className="calendar-field-label calendar-field-label-with-help">
                {t("calendarEditor.attendees")}
                <ClickTooltip label={t("database.showHelp")} text={t("calendarEditor.attendeesHint")} />
              </span>
              <input
                className="calendar-editor-input"
                type="email"
                multiple
                value={valueFor(GOOGLE_CALENDAR_PROPERTY_IDS.attendees)}
                placeholder={t("calendarEditor.attendeesPlaceholder")}
                aria-label={t("calendarEditor.attendees")}
                onChange={(event) => updateValue(GOOGLE_CALENDAR_PROPERTY_IDS.attendees, event.target.value)}
              />
            </label>
            <label className="calendar-field">
              <span className="calendar-field-label">{t("calendarEditor.notes")}</span>
              <textarea className="calendar-editor-input calendar-editor-notes" rows={5} value={valueFor(GOOGLE_CALENDAR_PROPERTY_IDS.notes)} placeholder={t("calendarEditor.notesPlaceholder")} aria-label={t("calendarEditor.notes")} onChange={(event) => updateValue(GOOGLE_CALENDAR_PROPERTY_IDS.notes, event.target.value)} />
            </label>
          </div>
        </section>

        <section className="calendar-event-card calendar-target-card">
          <div className="calendar-editor-section-heading">
            <span className="page-kicker">{t("calendarEditor.destination")}</span>
            <h2>{t("calendarEditor.calendar")}</h2>
          </div>
          <label className="calendar-field">
            <span className="calendar-field-label calendar-field-label-with-help">
              {t("calendarEditor.calendar")}
              <ClickTooltip label={t("database.showHelp")} text={t("calendarEditor.calendarHint")} />
            </span>
            <select
              className="calendar-editor-input calendar-editor-select"
              value={selectedCalendarId}
              aria-label={t("calendarEditor.calendar")}
              disabled={calendarOptionsState === "loading" || calendarOptionsState === "error"}
              onChange={(event) => {
                const selected = visibleCalendars.find((calendar) => calendar.id === event.target.value);
                updateValues({
                  [GOOGLE_CALENDAR_PROPERTY_IDS.calendar]: selected?.title || "",
                  [GOOGLE_CALENDAR_PROPERTY_IDS.calendarId]: selected?.id || "",
                });
              }}
            >
              <option value="">{calendarOptionsState === "loading" ? t("calendarEditor.calendarLoading") : t("calendarEditor.calendarDefaultOption")}</option>
              {visibleCalendars.map((calendar) => <option value={calendar.id} key={calendar.id}>{calendar.title}{calendar.primary ? ` · ${t("calendar.primary")}` : ""}</option>)}
            </select>
          </label>
          <p className="calendar-editor-help">{calendarOptionsState === "error" ? t("calendarEditor.calendarLoadError") : t("calendarEditor.calendarHint")}</p>
        </section>

        <section className="calendar-event-advanced">
          <button type="button" className="calendar-advanced-toggle" aria-expanded={advancedOpen} onClick={() => setAdvancedOpen((open) => !open)}>
            <span>{advancedOpen ? "⌄" : "›"}</span>
            <span><strong>{t("calendarEditor.advanced")}</strong><small>{t("calendarEditor.advancedHint")}</small></span>
          </button>
          {advancedOpen && (
            <div className="calendar-advanced-content">
              {statusProperty && (
                <div className="calendar-editor-status">
                  <span className="calendar-field-label">{t("calendarEditor.status")}</span>
                  <PropertyCell property={statusProperty} value={getValue(row, statusProperty.id)} onChange={(value) => updateValue(statusProperty.id, value)} />
                </div>
              )}
              <label className="calendar-field">
                <span className="calendar-field-label">{t("calendarEditor.calendarId")}</span>
                <input className="calendar-editor-input" value={valueFor(GOOGLE_CALENDAR_PROPERTY_IDS.calendarId)} placeholder={t("calendarEditor.notAvailable")} aria-label={t("calendarEditor.calendarId")} onChange={(event) => updateValue(GOOGLE_CALENDAR_PROPERTY_IDS.calendarId, event.target.value)} />
              </label>
              <div className="calendar-readonly-grid">
                <div><span className="calendar-field-label">{t("calendarEditor.eventId")}</span><code>{valueFor(GOOGLE_CALENDAR_PROPERTY_IDS.id) || t("calendarEditor.notAvailable")}</code></div>
                <div><span className="calendar-field-label">{t("calendarEditor.updated")}</span><code>{valueFor(GOOGLE_CALENDAR_PROPERTY_IDS.updated) || t("calendarEditor.notAvailable")}</code></div>
              </div>
              {link && <a className="calendar-event-link" href={link} target="_blank" rel="noreferrer">{t("calendarEditor.openGoogleEvent")} ↗</a>}
            </div>
          )}
        </section>
      </div>
      <BlockEditor item={row} onChange={(blocks) => onUpdate({
        ...database,
        rows: database.rows.map((entry) => entry.id === row.id ? { ...entry, blocks } : entry),
      })} />
    </div>
  );
}

function GoogleTaskPage({ database, row, onUpdate, onBack, onDelete }: { database: Database; row: Row; onUpdate: (database: Database) => void; onBack: () => void; onDelete: () => boolean }) {
  const { t } = useLanguage();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const valueFor = (propertyId: string) => valueText(getValue(row, propertyId));
  const statusProperty = database.properties.find((property) => property.id === GOOGLE_TASK_PROPERTY_IDS.status);
  const link = safeExternalUrl(valueFor(GOOGLE_TASK_PROPERTY_IDS.link));
  const taskLists = [...new Set(database.rows.map((entry) => valueText(getValue(entry, GOOGLE_TASK_PROPERTY_IDS.list)).trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));

  const updateValues = (values: Record<string, CellValue>) => onUpdate({
    ...database,
    rows: database.rows.map((entry) => entry.id === row.id ? { ...entry, values: { ...entry.values, ...values } } : entry),
  });
  const updateValue = (propertyId: string, value: CellValue) => updateValues({ [propertyId]: value });
  const updateTitle = (title: string) => onUpdate({
    ...database,
    rows: database.rows.map((entry) => entry.id === row.id ? { ...entry, title } : entry),
  });

  return (
    <div className="row-page task-editor-page">
      <button className="back-link" onClick={onBack}>← {t("database.backTo", { title: database.title })}</button>
      <div className="row-page-heading task-editor-heading">
        <span className="page-kicker">{t("taskEditor.eyebrow")}</span>
        <input
          className="row-title-input"
          value={isUntitledRow(row.title) ? "" : row.title}
          placeholder={t("taskEditor.titlePlaceholder")}
          aria-label={t("taskEditor.titleLabel")}
          onChange={(event) => updateTitle(event.target.value)}
        />
        <div className="row-editor-actions">
          <button type="button" className="quiet-danger-button row-editor-delete" onClick={() => { if (onDelete()) onBack(); }}>
            × {t("taskEditor.deleteTask")}
          </button>
        </div>
      </div>

      <div className="calendar-event-editor">
        <section className="calendar-event-card task-editor-card">
          <div className="calendar-editor-section-heading">
            <span className="page-kicker">{t("taskEditor.details")}</span>
            <h2>{t("taskEditor.task")}</h2>
          </div>
          <div className="calendar-event-fields">
            <div className="task-editor-status-row">
              <span className="calendar-field-label calendar-field-label-with-help">
                {t("taskEditor.status")}
                <ClickTooltip label={t("database.showHelp")} text={t("database.googleStatusHelp")} />
              </span>
              {statusProperty && <PropertyCell property={statusProperty} value={getValue(row, statusProperty.id)} onChange={(value) => updateValue(statusProperty.id, value)} />}
            </div>
            <label className="calendar-field">
              <span className="calendar-field-label">{t("taskEditor.due")}</span>
              <input className="calendar-editor-input" type="date" value={valueFor(GOOGLE_TASK_PROPERTY_IDS.due)} aria-label={t("taskEditor.due")} onChange={(event) => updateValue(GOOGLE_TASK_PROPERTY_IDS.due, event.target.value)} />
            </label>
            <label className="calendar-field">
              <span className="calendar-field-label">{t("taskEditor.notes")}</span>
              <textarea className="calendar-editor-input calendar-editor-notes" rows={5} value={valueFor(GOOGLE_TASK_PROPERTY_IDS.notes)} placeholder={t("taskEditor.notesPlaceholder")} aria-label={t("taskEditor.notes")} onChange={(event) => updateValue(GOOGLE_TASK_PROPERTY_IDS.notes, event.target.value)} />
            </label>
          </div>
        </section>

        <section className="calendar-event-card task-target-card">
          <div className="calendar-editor-section-heading">
            <span className="page-kicker">{t("taskEditor.destination")}</span>
            <h2>{t("taskEditor.list")}</h2>
          </div>
          <label className="calendar-field">
            <span className="calendar-field-label calendar-field-label-with-help">
              {t("taskEditor.list")}
              <ClickTooltip label={t("database.showHelp")} text={t("database.googleListHelp")} />
            </span>
            <input className="calendar-editor-input" list={`google-task-lists-${row.id}`} value={valueFor(GOOGLE_TASK_PROPERTY_IDS.list)} placeholder={t("taskEditor.listPlaceholder")} aria-label={t("taskEditor.list")} onChange={(event) => updateValue(GOOGLE_TASK_PROPERTY_IDS.list, event.target.value)} />
            <datalist id={`google-task-lists-${row.id}`}>
              {taskLists.map((list) => <option value={list} key={list} />)}
            </datalist>
          </label>
          <p className="calendar-editor-help">{t("taskEditor.listHint")}</p>
        </section>

        <section className="calendar-event-advanced">
          <button type="button" className="calendar-advanced-toggle" aria-expanded={advancedOpen} onClick={() => setAdvancedOpen((open) => !open)}>
            <span>{advancedOpen ? "⌄" : "›"}</span>
            <span><strong>{t("taskEditor.advanced")}</strong><small>{t("taskEditor.advancedHint")}</small></span>
          </button>
          {advancedOpen && (
            <div className="calendar-advanced-content">
              <div className="calendar-readonly-grid">
                <div><span className="calendar-field-label">{t("taskEditor.googleId")}</span><code>{valueFor(GOOGLE_TASK_PROPERTY_IDS.id) || t("taskEditor.notAvailable")}</code></div>
                <div><span className="calendar-field-label">{t("taskEditor.position")}</span><code>{valueFor(GOOGLE_TASK_PROPERTY_IDS.position) || t("taskEditor.notAvailable")}</code></div>
              </div>
              <div className="calendar-readonly-grid">
                <div><span className="calendar-field-label calendar-field-label-with-help">{t("taskEditor.parent") }<ClickTooltip label={t("database.showHelp")} text={t("database.googleParentHelp")} /></span><code>{valueFor(GOOGLE_TASK_PROPERTY_IDS.parent) || t("taskEditor.notAvailable")}</code></div>
                <div><span className="calendar-field-label">{t("taskEditor.syncState")}</span><code>{t("taskEditor.syncStateValue")}</code></div>
              </div>
              {link && <a className="calendar-event-link" href={link} target="_blank" rel="noreferrer">{t("taskEditor.openGoogleTask")} ↗</a>}
            </div>
          )}
        </section>
      </div>
      <BlockEditor item={row} onChange={(blocks) => onUpdate({
        ...database,
        rows: database.rows.map((entry) => entry.id === row.id ? { ...entry, blocks } : entry),
      })} />
    </div>
  );
}

export function DatabaseView({ database, onUpdate, initialRowId }: DatabaseViewProps) {
  const { t } = useLanguage();
  const [openRowId, setOpenRowId] = useState<string | null>(initialRowId || null);
  const activeView = database.views?.[database.view.mode] || database.view;
  const openRowPage = (rowId: string) => {
    setOpenRowId(rowId);
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  };

  const updateView = (patch: Partial<ViewSettings>) => {
    const nextView = { ...activeView, ...patch, mode: activeView.mode };
    onUpdate({ ...database, view: nextView, views: { ...database.views, [activeView.mode]: nextView } });
  };

  const switchMode = (mode: ViewMode) => {
    const nextView = database.views?.[mode] || {
      ...emptyView(mode),
      groupBy: database.properties.find((entry) => entry.type === "select")?.id || "",
    };
    onUpdate({ ...database, view: nextView, views: { ...database.views, [mode]: nextView } });
  };

  const updateCell = (rowId: string, propertyId: string, value: CellValue) => onUpdate({
    ...database,
    rows: database.rows.map((row) => row.id === rowId ? { ...row, values: { ...row.values, [propertyId]: value } } : row),
  });

  const visibleRows = useMemo(() => {
    let rows = database.rows.filter((row) => activeView.filters.every((filter) => {
      const property = database.properties.find((entry) => entry.id === filter.propertyId);
      return property ? matchesFilter(row, property, filter) : true;
    }));
    if (activeView.sortBy) {
      const sortProperty = database.properties.find((entry) => entry.id === activeView.sortBy);
      if (sortProperty) {
        rows = [...rows].sort((a, b) => {
          const aValue = valueText(a.values[sortProperty.id]).toLowerCase();
          const bValue = valueText(b.values[sortProperty.id]).toLowerCase();
          return activeView.sortDir === "asc"
            ? aValue.localeCompare(bValue, undefined, { numeric: true })
            : bValue.localeCompare(aValue, undefined, { numeric: true });
        });
      }
    }
    return rows;
  }, [activeView, database.properties, database.rows]);

  const addRow = (initialValues: Record<string, CellValue> = {}) => {
    const rowId = uid("row");
    onUpdate({
      ...database,
      rows: [
        ...database.rows,
        {
          id: rowId,
          title: t("database.untitledRow"),
          values: {
            ...Object.fromEntries(
              database.properties.map((entry) => [entry.id, entry.type === "checkbox" ? false : entry.type === "multi-select" ? [] : ""]),
            ),
            ...(database.id === GOOGLE_CALENDAR_DATABASE_ID ? { [GOOGLE_CALENDAR_PROPERTY_IDS.attendees]: GOOGLE_CALENDAR_DEFAULT_ATTENDEE } : {}),
            ...initialValues,
          },
          blocks: [createBlock("paragraph")],
        },
      ],
    });
    return rowId;
  };

  const deleteRow = (rowId: string, confirmation = t("database.deleteRow")) => {
    if (window.confirm(confirmation)) {
      onUpdate({ ...database, rows: database.rows.filter((row) => row.id !== rowId) });
      return true;
    }
    return false;
  };

  const addFilter = () => {
    const first = database.properties[0];
    if (!first) return;
    updateView({ filters: [...activeView.filters, { propertyId: first.id, query: "", operator: defaultFilterOperator(first) }] });
  };

  const changeFilter = (index: number, patch: Partial<Filter>) => {
    const nextFilters = activeView.filters.map((filter, filterIndex) => {
      if (filterIndex !== index) return filter;
      if (patch.propertyId && patch.propertyId !== filter.propertyId) {
        return {
          ...filter,
          ...patch,
          query: "",
          operator: defaultFilterOperator(database.properties.find((entry) => entry.id === patch.propertyId)),
        };
      }
      return { ...filter, ...patch };
    });
    updateView({ filters: nextFilters });
  };

  const openRow = openRowId ? database.rows.find((row) => row.id === openRowId) : undefined;
  if (openRow) {
    if (database.id === GOOGLE_CALENDAR_DATABASE_ID) {
      return <CalendarEventPage database={database} row={openRow} onUpdate={onUpdate} onBack={() => setOpenRowId(null)} onDelete={() => deleteRow(openRow.id, t("calendarEditor.deleteConfirm"))} />;
    }
    if (database.id === GOOGLE_TASKS_DATABASE_ID) {
      return <GoogleTaskPage database={database} row={openRow} onUpdate={onUpdate} onBack={() => setOpenRowId(null)} onDelete={() => deleteRow(openRow.id, t("taskEditor.deleteConfirm"))} />;
    }
    return <RowPage database={database} row={openRow} onUpdate={onUpdate} onBack={() => setOpenRowId(null)} />;
  }

  if (database.id === GOOGLE_TASKS_DATABASE_ID) {
    return (
      <GoogleTasksInterface
        database={database}
        rows={visibleRows}
        onOpenRow={openRowPage}
        onUpdateCell={updateCell}
        onAddRow={addRow}
        onDeleteRow={deleteRow}
      />
    );
  }

  if (database.id === GOOGLE_CALENDAR_DATABASE_ID) {
    return (
      <GoogleCalendarInterface
        database={database}
        rows={visibleRows}
        onOpenRow={openRowPage}
        onUpdateCell={updateCell}
        onAddRow={addRow}
        onDeleteRow={deleteRow}
      />
    );
  }

  const selectProperty =
    database.properties.find((entry) => entry.id === activeView.groupBy && entry.type === "select") ||
    database.properties.find((entry) => entry.type === "select");
  const columns = selectProperty?.options || [];
  const filterOperators = (property: Property | undefined): FilterOperator[] => {
    if (property?.type === "checkbox") return ["checked", "unchecked"];
    if (property?.type === "date") return ["before", "after", "is", "is-not"];
    if (property?.type === "select") return ["is", "is-not", "contains"];
    return ["contains", "is", "is-not"];
  };

  return (
    <div className="database-page">
      <div className="database-heading">
        <div>
          <div className="page-kicker">{t("database.title")}</div>
          <h1><span className="database-title-icon">{database.icon}</span>{database.title}</h1>
          <p>{t("database.recordSummary", { records: database.rows.length, properties: database.properties.length })}</p>
        </div>
        <button className="primary-button" onClick={() => addRow()}>＋ {t("database.newRow")}</button>
      </div>
      <div className="database-toolbar">
        <div className="view-switcher" aria-label={t("database.view")}>
          {(["table", "board", "list"] as ViewMode[]).map((mode) => (
            <button className={activeView.mode === mode ? "active" : ""} key={mode} onClick={() => switchMode(mode)}>
              <span>{mode === "table" ? "▤" : mode === "board" ? "▥" : "☷"}</span>
              {t(`database.${mode}`)}
            </button>
          ))}
        </div>
        <div className="view-settings">
          <label>{t("database.sort")}
            <select value={activeView.sortBy} onChange={(event) => updateView({ sortBy: event.target.value })}>
              <option value="">{t("database.none")}</option>
              {database.properties.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
            </select>
          </label>
          {activeView.sortBy && (
            <button className="icon-button" aria-label={t("database.reverseSort")} onClick={() => updateView({ sortDir: activeView.sortDir === "asc" ? "desc" : "asc" })}>
              {activeView.sortDir === "asc" ? "↑" : "↓"}
            </button>
          )}
          <button className="small-button" onClick={addFilter}>＋ {t("database.filter")}</button>
        </div>
      </div>
      {activeView.filters.length > 0 && (
        <div className="filter-bar">
          {activeView.filters.map((filter, index) => {
            const filterProperty = database.properties.find((entry) => entry.id === filter.propertyId);
            return (
              <div className="filter-pill" key={`${filter.propertyId}-${index}`}>
                <span>{t("database.filter")}</span>
                <select value={filter.propertyId} onChange={(event) => changeFilter(index, { propertyId: event.target.value })}>
                  {database.properties.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
                </select>
                <select value={filter.operator} onChange={(event) => changeFilter(index, { operator: event.target.value as FilterOperator })}>
                  {filterOperators(filterProperty).map((operator) => <option key={operator} value={operator}>{t(`operators.${operator}`)}</option>)}
                </select>
                {filterProperty?.type !== "checkbox" && (
                  <input
                    type={filterProperty?.type === "date" ? "date" : "text"}
                    placeholder={filterProperty?.type === "date" ? t("database.chooseDate") : t("database.value")}
                    value={filter.query}
                    onChange={(event) => changeFilter(index, { query: event.target.value })}
                  />
                )}
                <button aria-label={t("database.removeFilter")} onClick={() => updateView({ filters: activeView.filters.filter((_, filterIndex) => filterIndex !== index) })}>×</button>
              </div>
            );
          })}
        </div>
      )}
      {activeView.mode === "table" && (
        <div className="table-wrap">
          <table>
            <thead><tr><th className="row-title-col">{t("database.name")}</th>{database.properties.map((entry) => <th key={entry.id}>{entry.name}<small>{t(`properties.${entry.type}`)}</small></th>)}<th /></tr></thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={row.id}>
                  <td className="row-name"><div className="row-name-cell">
                    <span className="row-bullet">↗</span>
                    <input
                      className="row-title-cell"
                      aria-label={`${t("database.rowTitle")}: ${row.title}`}
                      value={row.title}
                      onChange={(event) => onUpdate({ ...database, rows: database.rows.map((entry) => entry.id === row.id ? { ...entry, title: event.target.value } : entry) })}
                    />
                    <button className="row-open" aria-label={`${t("database.openRow")}: ${row.title}`} onClick={() => openRowPage(row.id)}>→</button>
                  </div></td>
                  {database.properties.map((entry) => (
                    <td key={entry.id}><PropertyCell property={entry} value={getValue(row, entry.id)} onChange={(value) => updateCell(row.id, entry.id, value)} /></td>
                  ))}
                  <td><button className="delete-row" onClick={() => deleteRow(row.id)} aria-label={`${t("database.deleteRowLabel")}: ${row.title}`}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {visibleRows.length === 0 && <div className="empty-state">{t("database.noRows")}</div>}
      <button className="add-row-link" onClick={() => addRow()}>＋ {t("database.addRow")}</button>
        </div>
      )}
      {activeView.mode === "board" && (
        <div className="board-wrap">
          <div className="board-toolbar">
            <label>{t("database.groupBy")}
              <select value={selectProperty?.id || ""} onChange={(event) => updateView({ groupBy: event.target.value })}>
                {database.properties.filter((entry) => entry.type === "select").map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
              </select>
            </label>
            <span>{t("database.dragCards")}</span>
          </div>
          <div className="board-columns">
            {columns.length ? columns.map((column) => {
              const columnRows = visibleRows.filter((row) => getValue(row, selectProperty?.id || "") === column.label);
              return (
                <section
                  className="board-column"
                  key={column.id}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    const rowId = event.dataTransfer.getData("row-id");
                    if (rowId && selectProperty) updateCell(rowId, selectProperty.id, column.label);
                  }}
                >
                  <div className="column-heading"><span className="color-dot" style={{ background: column.color }} />{column.label}<small>{columnRows.length}</small></div>
                  {columnRows.map((row) => (
                    <button
                      className="board-card"
                      key={row.id}
                      draggable
                      onDragStart={(event) => event.dataTransfer.setData("row-id", row.id)}
                      onClick={() => openRowPage(row.id)}
                    >
                      <span className="card-title">{row.title}</span>
                      <span className="card-meta">
                        {database.properties.slice(1, 3).map((entry) => <span key={entry.id}><small>{entry.name}</small><ValueDisplay property={entry} value={getValue(row, entry.id)} /></span>)}
                      </span>
                    </button>
                  ))}
                </section>
              );
            }) : <div className="empty-state">{t("database.addSelect")}</div>}
          </div>
        </div>
      )}
      {activeView.mode === "list" && (
        <div className="list-view">
          {visibleRows.map((row) => (
            <button className="list-row" key={row.id} onClick={() => openRowPage(row.id)}>
              <span className="list-leading">↗</span>
              <strong>{row.title}</strong>
              <span className="list-properties">
                {database.properties.slice(0, 2).map((entry) => (
                  <span key={entry.id}><small>{entry.name}</small><ValueDisplay property={entry} value={getValue(row, entry.id)} /></span>
                ))}
              </span>
              <span className="list-arrow">→</span>
            </button>
          ))}
          {visibleRows.length === 0 && <div className="empty-state">{t("database.noRows")}</div>}
        </div>
      )}
      <PropertyManager database={database} onUpdate={onUpdate} />
    </div>
  );
}
