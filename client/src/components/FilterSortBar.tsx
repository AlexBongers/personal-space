import { useState, useCallback } from "react";
import type { Database, Property, Filter, View } from "shared/types";
import styles from "./FilterSortBar.module.css";

interface FilterSortBarProps {
  database: Database;
  view: View;
  onViewChange: (view: View) => void;
}

type OperatorOption = {
  value: string;
  label: string;
};

function operatorsForType(type: Property["type"]): OperatorOption[] {
  switch (type) {
    case "text":
    case "url":
      return [
        { value: "is", label: "Is" },
        { value: "is_not", label: "Is not" },
        { value: "contains", label: "Contains" },
        { value: "does_not_contain", label: "Does not contain" },
        { value: "starts_with", label: "Starts with" },
        { value: "ends_with", label: "Ends with" },
        { value: "is_empty", label: "Is empty" },
        { value: "is_not_empty", label: "Is not empty" },
      ];
    case "number":
      return [
        { value: "is", label: "Is" },
        { value: "is_not", label: "Is not" },
        { value: "greater_than", label: ">" },
        { value: "less_than", label: "<" },
        { value: "greater_than_equal", label: ">=" },
        { value: "less_than_equal", label: "<=" },
        { value: "is_empty", label: "Is empty" },
        { value: "is_not_empty", label: "Is not empty" },
      ];
    case "select":
    case "multi-select":
      return [
        { value: "is", label: "Is" },
        { value: "is_not", label: "Is not" },
        { value: "is_empty", label: "Is empty" },
        { value: "is_not_empty", label: "Is not empty" },
      ];
    case "checkbox":
      return [
        { value: "is", label: "Is" },
        { value: "is_not", label: "Is not" },
      ];
    case "date":
      return [
        { value: "is", label: "Is" },
        { value: "is_before", label: "Is before" },
        { value: "is_after", label: "Is after" },
        { value: "is_empty", label: "Is empty" },
        { value: "is_not_empty", label: "Is not empty" },
      ];
    default:
      return [
        { value: "is", label: "Is" },
        { value: "is_not", label: "Is not" },
      ];
  }
}

const noValueOperators = new Set(["is_empty", "is_not_empty"]);

function FilterValueInput({
  filter,
  property,
  onChange,
}: {
  filter: Filter;
  property: Property;
  onChange: (filter: Filter) => void;
}) {
  const needsValue = !noValueOperators.has(filter.operator);

  if (!needsValue) return null;

  if (property.type === "select" || property.type === "multi-select") {
    return (
      <select
        className={styles.filterSelect}
        value={String(filter.value || "")}
        onChange={(e) => onChange({ ...filter, value: e.target.value })}
        style={{ width: 130 }}
      >
        <option value="">Select...</option>
        {(property.options || []).map((opt) => (
          <option key={opt.id} value={opt.value}>
            {opt.value}
          </option>
        ))}
      </select>
    );
  }

  if (property.type === "checkbox") {
    return (
      <div className={styles.checkboxOption}>
        <input
          type="checkbox"
          className={styles.checkboxInput}
          checked={Boolean(filter.value)}
          onChange={(e) => onChange({ ...filter, value: e.target.checked })}
        />
        <span style={{ fontSize: 12, color: "var(--text-primary)" }}>
          {filter.value ? "True" : "False"}
        </span>
      </div>
    );
  }

  if (property.type === "date") {
    return (
      <input
        type="date"
        className={styles.filterInput}
        value={typeof filter.value === "string" ? filter.value.substring(0, 10) : ""}
        onChange={(e) => onChange({ ...filter, value: e.target.value })}
        style={{ width: 150 }}
      />
    );
  }

  if (property.type === "number") {
    return (
      <input
        type="number"
        className={styles.filterInput}
        value={filter.value !== undefined && filter.value !== null ? String(filter.value) : ""}
        onChange={(e) => onChange({ ...filter, value: e.target.value === "" ? "" : Number(e.target.value) })}
        placeholder="Value..."
        style={{ width: 100 }}
      />
    );
  }

  return (
    <input
      type="text"
      className={styles.filterInput}
      value={String(filter.value || "")}
      onChange={(e) => onChange({ ...filter, value: e.target.value })}
      placeholder="Value..."
      style={{ width: 120 }}
    />
  );
}

function generateFilterId(): string {
  return `filt_${Math.random().toString(36).substring(2, 9)}`;
}

export default function FilterSortBar({ database, view, onViewChange }: FilterSortBarProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [showSort, setShowSort] = useState(false);
  const properties = database.properties || [];

  const handleAddFilter = useCallback(() => {
    const firstProp = properties[0];
    if (!firstProp) return;
    const ops = operatorsForType(firstProp.type);
    const newFilter: Filter = {
      id: generateFilterId(),
      field: firstProp.id,
      operator: ops[0]?.value || "is",
      value: firstProp.type === "checkbox" ? false : "",
    };
    const updated = { ...view, filters: [...view.filters, newFilter] };
    onViewChange(updated);
  }, [properties, view, onViewChange]);

  const handleRemoveFilter = useCallback(
    (filterId: string) => {
      const updated = {
        ...view,
        filters: view.filters.filter((f) => f.id !== filterId),
      };
      onViewChange(updated);
    },
    [view, onViewChange]
  );

  const handleFilterChange = useCallback(
    (updatedFilter: Filter) => {
      const updated = {
        ...view,
        filters: view.filters.map((f) =>
          f.id === updatedFilter.id ? updatedFilter : f
        ),
      };
      onViewChange(updated);
    },
    [view, onViewChange]
  );

  const handleSortChange = useCallback(
    (field: string) => {
      if (field === "") {
        onViewChange({ ...view, sortField: null, sortDirection: "asc" as const });
        return;
      }
      onViewChange({ ...view, sortField: field });
    },
    [view, onViewChange]
  );

  const handleSortDirToggle = useCallback(() => {
    if (!view.sortField) return;
    const nextDir: "asc" | "desc" = view.sortDirection === "asc" ? "desc" : "asc";
    onViewChange({ ...view, sortDirection: nextDir });
  }, [view, onViewChange]);

  const hasFilters = view.filters.length > 0;
  const hasSort = !!view.sortField;

  const sortProp = view.sortField
    ? properties.find((p) => p.id === view.sortField)
    : undefined;

  return (
    <div className={styles.container}>
      <button
        className={`${styles.toggleBtn} ${hasFilters || showFilters ? styles.toggleBtnActive : ""}`}
        onClick={() => {
          setShowFilters(!showFilters);
          setShowSort(false);
        }}
      >
        <span>⊞</span>
        <span>Filter{hasFilters ? ` (${view.filters.length})` : ""}</span>
      </button>

      <button
        className={`${styles.sortBtn} ${hasSort || showSort ? styles.sortBtnActive : ""}`}
        onClick={() => {
          setShowSort(!showSort);
          setShowFilters(false);
        }}
      >
        <span>{view.sortDirection === "desc" ? "↓" : "↑"}</span>
        <span>Sort{sortProp ? `: ${sortProp.name}` : ""}</span>
      </button>

      {hasFilters && !showFilters && (
        <div className={styles.activeFilters}>
          {view.filters.map((f) => {
            const prop = properties.find((p) => p.id === f.field);
            return (
              <span key={f.id} className={styles.filterPill}>
                {prop?.name || f.field}: {f.operator.replace(/_/g, " ")}
                {!noValueOperators.has(f.operator) && f.value !== "" && f.value !== null && (
                  <> = {String(f.value)}</>
                )}
                <button
                  className={styles.filterPillRemove}
                  onClick={() => handleRemoveFilter(f.id)}
                >
                  ✕
                </button>
              </span>
            );
          })}
        </div>
      )}

      {showFilters && (
        <div className={styles.panel}>
          <div className={styles.panelLabel}>Filters</div>
          {view.filters.length > 0 ? (
            <div className={styles.filterList}>
              {view.filters.map((f) => {
                const prop = properties.find((p) => p.id === f.field);
                const ops = prop ? operatorsForType(prop.type) : [];
                return (
                  <div key={f.id} className={styles.filterRow}>
                    <select
                      className={styles.filterSelect}
                      value={f.field}
                      onChange={(e) => {
                        const newProp = properties.find((p) => p.id === e.target.value);
                        const newOps = newProp ? operatorsForType(newProp.type) : [];
                        handleFilterChange({
                          ...f,
                          field: e.target.value,
                          operator: newOps[0]?.value || "is",
                          value: newProp?.type === "checkbox" ? false : "",
                        });
                      }}
                      style={{ width: 130 }}
                    >
                      {properties.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <select
                      className={styles.filterSelect}
                      value={f.operator}
                      onChange={(e) =>
                        handleFilterChange({ ...f, operator: e.target.value })
                      }
                      style={{ width: 130 }}
                    >
                      {ops.map((op) => (
                        <option key={op.value} value={op.value}>
                          {op.label}
                        </option>
                      ))}
                    </select>
                    {prop && (
                      <FilterValueInput
                        filter={f}
                        property={prop}
                        onChange={handleFilterChange}
                      />
                    )}
                    <button
                      className={styles.removeBtn}
                      onClick={() => handleRemoveFilter(f.id)}
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: "var(--text-muted)", padding: "4px 0" }}>
              No filters applied. Add a filter to narrow down rows.
            </div>
          )}
          <div className={styles.panelActions}>
            <button className={styles.addFilterBtn} onClick={handleAddFilter}>
              + Add filter
            </button>
            <button
              className={styles.applyBtn}
              onClick={() => setShowFilters(false)}
            >
              Done
            </button>
          </div>
        </div>
      )}

      {showSort && (
        <div className={styles.sortPanel}>
          <div className={styles.panelLabel}>Sort</div>
          <div className={styles.sortRow}>
            <select
              className={styles.filterSelect}
              value={view.sortField || ""}
              onChange={(e) => handleSortChange(e.target.value)}
              style={{ flex: 1 }}
            >
              <option value="">None</option>
              <option value="__title">Title</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {view.sortField && (
              <button
                className={styles.toggleBtn}
                onClick={handleSortDirToggle}
                style={{ padding: "4px 8px" }}
              >
                {view.sortDirection === "asc" ? "↑ Asc" : "↓ Desc"}
              </button>
            )}
          </div>
          <button
            className={styles.applyBtn}
            onClick={() => setShowSort(false)}
            style={{ marginTop: 12, width: "100%" }}
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}
