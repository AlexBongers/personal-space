"use client";

import { useMemo, useState } from "react";
import { BlockEditor } from "./BlockEditor";
import { useLanguage } from "./i18n";
import {
  createBlock,
  createOption,
  defaultFilterOperator,
  emptyView,
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
  saveLabel?: string;
};

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
    const selected = optionForValue(property, value);
    return (
      <span className="select-cell-shell">
        <i style={{ background: selected?.color || "var(--faint)" }} />
        <select className="cell-select" value={String(value || "")} onChange={(event) => onChange(event.target.value)}>
          <option value="">{t("database.empty")}</option>
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
    const selected = optionForValue(property, value);
    return value ? <span className="value-tag"><i style={{ background: selected?.color || "var(--faint)" }} />{String(value)}</span> : <span className="value-empty">—</span>;
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
        <div><span className="eyebrow">{t("database.schema")}</span><strong>{t("database.properties")}</strong></div>
        <button className="small-button" onClick={addProperty}>＋ {t("database.addProperty")}</button>
      </div>
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
    </section>
  );
}

function RowPage({ database, row, onUpdate, onBack, saveLabel }: { database: Database; row: Row; onUpdate: (database: Database) => void; onBack: () => void; saveLabel?: string }) {
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
          <label key={property.id}>
            <span>{property.name}</span>
            <PropertyCell property={property} value={getValue(row, property.id)} onChange={(value) => updateValue(property.id, value)} />
          </label>
        ))}
      </div>
      <BlockEditor item={row} onChange={updateBlocks} saveLabel={saveLabel} />
    </div>
  );
}

export function DatabaseView({ database, onUpdate, initialRowId, saveLabel }: DatabaseViewProps) {
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

  const addRow = () => onUpdate({
    ...database,
    rows: [
      ...database.rows,
      {
        id: uid("row"),
        title: t("database.untitledRow"),
        values: Object.fromEntries(
          database.properties.map((entry) => [entry.id, entry.type === "checkbox" ? false : entry.type === "multi-select" ? [] : ""]),
        ),
        blocks: [createBlock("paragraph")],
      },
    ],
  });

  const deleteRow = (rowId: string) => {
    if (window.confirm(t("database.deleteRow"))) {
      onUpdate({ ...database, rows: database.rows.filter((row) => row.id !== rowId) });
    }
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
    return <RowPage database={database} row={openRow} onUpdate={onUpdate} onBack={() => setOpenRowId(null)} saveLabel={saveLabel} />;
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
        <button className="primary-button" onClick={addRow}>＋ {t("database.newRow")}</button>
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
          <button className="add-row-link" onClick={addRow}>＋ {t("database.addRow")}</button>
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
