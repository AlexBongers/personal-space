import { useState, useCallback, useRef, useEffect } from "react";
import type { Row, Property, SelectOption, Database } from "shared/types";
import * as api from "../api";
import PropertyEditor from "./PropertyEditor";
import styles from "./TableView.module.css";

interface TableViewProps {
  database: Database;
  rows: Row[];
  onRowsChanged: () => void;
  onDatabaseChanged: (db: Database) => void;
  onOpenRow: (row: Row) => void;
}

function cellValue(row: Row, prop: Property): unknown {
  if (!row.data || typeof row.data !== "object") return "";
  const val = (row.data as Record<string, unknown>)[prop.id];
  return val;
}

function parseSelectVal(val: unknown): string[] {
  if (Array.isArray(val)) return val.map((v) => String(v));
  if (typeof val === "string") return val.split(",").map((v) => v.trim()).filter(Boolean);
  return [];
}

function findOption(options: SelectOption[] | undefined, value: string): SelectOption | undefined {
  if (!options) return undefined;
  return options.find((o) => o.id === value || o.value === value);
}

function getContrastColor(hex: string): string {
  try {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? "#1a1a1a" : "#ffffff";
  } catch {
    return "#ffffff";
  }
}

interface CellEditorProps {
  row: Row;
  property: Property;
  onSave: (rowId: string, propId: string, value: unknown) => void;
  databaseId: string;
  onOptionsChanged: () => void;
}

function CellEditor({ row, property, onSave, databaseId, onOptionsChanged }: CellEditorProps) {
  const [editing, setEditing] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [showOptionEditor, setShowOptionEditor] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const val = cellValue(row, property);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editing]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowOptions(false);
        setShowOptionEditor(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleCellClick = useCallback(() => {
    if (property.type === "checkbox") {
      const newVal = val === true ? false : true;
      onSave(row.id, property.id, newVal);
      return;
    }
    if (property.type === "select" || property.type === "multi-select") {
      setShowOptions(true);
      setShowOptionEditor(false);
      return;
    }
    setEditing(true);
  }, [property.type, val, row.id, property.id, onSave]);

  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      if (property.type === "number") {
        const numVal = e.target.value === "" ? "" : Number(e.target.value);
        onSave(row.id, property.id, isNaN(numVal as number) ? "" : numVal);
      } else {
        onSave(row.id, property.id, e.target.value);
      }
      setEditing(false);
    },
    [property.type, row.id, property.id, onSave]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.currentTarget.blur();
      }
      if (e.key === "Escape") {
        setEditing(false);
      }
    },
    []
  );

  const handleOptionSelect = useCallback(
    (option: SelectOption) => {
      if (property.type === "select") {
        onSave(row.id, property.id, option.value);
        setShowOptions(false);
      } else {
        const selected = parseSelectVal(val);
        const idx = selected.indexOf(option.value);
        const newVal = idx >= 0 ? selected.filter((v) => v !== option.value) : [...selected, option.value];
        onSave(row.id, property.id, newVal);
      }
    },
    [property.type, val, row.id, property.id, onSave]
  );

  const formattedVal = (() => {
    if (val === null || val === undefined || val === "") return "";
    if (property.type === "number") return String(val);
    if (property.type === "date" && typeof val === "string") return val;
    return String(val);
  })();

  if (editing) {
    if (property.type === "number") {
      return (
        <input
          ref={inputRef}
          type="number"
          className={styles.cellInput}
          defaultValue={String(val || "")}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
        />
      );
    }
    if (property.type === "date") {
      return (
        <input
          ref={inputRef}
          type="date"
          className={styles.cellInput}
          defaultValue={typeof val === "string" ? val.substring(0, 10) : ""}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
        />
      );
    }
    return (
      <input
        ref={inputRef}
        type="text"
        className={styles.cellInput}
        defaultValue={formattedVal}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      />
    );
  }

  if (property.type === "checkbox") {
    return (
      <div className={styles.checkboxDisplay}>
        <input
          type="checkbox"
          className={styles.checkboxInput}
          checked={Boolean(val)}
          onChange={handleCellClick}
        />
      </div>
    );
  }

  if (property.type === "select") {
    const opt = findOption(property.options, String(val));
    return (
      <div style={{ position: "relative" }} ref={dropdownRef}>
        <div className={styles.cellContent} onClick={handleCellClick}>
          {opt ? (
            <span
              className={styles.selectTag}
              style={{
                backgroundColor: opt.color || "gray",
                color: getContrastColor(opt.color || "gray"),
              }}
            >
              {opt.value}
            </span>
          ) : (
            <span style={{ color: "var(--text-muted)", fontSize: 12 }}>Empty</span>
          )}
        </div>
        {showOptions && (
          <div className={styles.selectDropdown}>
            {property.options?.map((option) => (
              <div
                key={option.id}
                className={styles.selectOption}
                onClick={() => handleOptionSelect(option)}
              >
                <span
                  className={styles.selectOptionDot}
                  style={{ backgroundColor: option.color || "gray" }}
                />
                <span style={{ flex: 1 }}>{option.value}</span>
                {String(val) === option.value && (
                  <span className={styles.selectOptionSelected}>✓</span>
                )}
              </div>
            ))}
            <div
              style={{
                borderTop: "1px solid var(--border)",
                padding: "6px 12px",
                fontSize: 12,
                color: "var(--blue)",
                cursor: "pointer",
              }}
              onClick={() => {
                setShowOptionEditor(true);
                setShowOptions(false);
              }}
            >
              Edit options...
            </div>
          </div>
        )}
        {showOptionEditor && (
          <div
            style={{ position: "absolute", top: "100%", left: 0, zIndex: 21, marginTop: 2 }}
            ref={dropdownRef}
          >
            <SelectOptionEditorInline
              databaseId={databaseId}
              property={property}
              onOptionsChanged={() => {
                onOptionsChanged();
                setShowOptionEditor(false);
              }}
              onClose={() => setShowOptionEditor(false)}
            />
          </div>
        )}
      </div>
    );
  }

  if (property.type === "multi-select") {
    const selectedVals = parseSelectVal(val);
    return (
      <div style={{ position: "relative" }} ref={dropdownRef}>
        <div className={styles.cellContent} onClick={handleCellClick}>
          {selectedVals.length > 0 ? (
            <div className={styles.selectDisplay}>
              {selectedVals.map((v) => {
                const opt = findOption(property.options, v);
                return (
                  <span
                    key={v}
                    className={styles.selectTag}
                    style={{
                      backgroundColor: opt?.color || "gray",
                      color: getContrastColor(opt?.color || "gray"),
                    }}
                  >
                    {opt?.value || v}
                  </span>
                );
              })}
            </div>
          ) : (
            <span style={{ color: "var(--text-muted)", fontSize: 12 }}>Empty</span>
          )}
        </div>
        {showOptions && (
          <div className={styles.selectDropdown}>
            {property.options?.map((option) => (
              <div
                key={option.id}
                className={styles.selectOption}
                onClick={() => handleOptionSelect(option)}
              >
                <span
                  className={styles.selectOptionDot}
                  style={{ backgroundColor: option.color || "gray" }}
                />
                <span style={{ flex: 1 }}>{option.value}</span>
                {selectedVals.includes(option.value) && (
                  <span className={styles.selectOptionSelected}>✓</span>
                )}
              </div>
            ))}
            <div
              style={{
                borderTop: "1px solid var(--border)",
                padding: "6px 12px",
                fontSize: 12,
                color: "var(--blue)",
                cursor: "pointer",
              }}
              onClick={() => {
                setShowOptionEditor(true);
                setShowOptions(false);
              }}
            >
              Edit options...
            </div>
          </div>
        )}
        {showOptionEditor && (
          <div style={{ position: "absolute", top: "100%", left: 0, zIndex: 21, marginTop: 2 }}>
            <SelectOptionEditorInline
              databaseId={databaseId}
              property={property}
              onOptionsChanged={() => {
                onOptionsChanged();
                setShowOptionEditor(false);
              }}
              onClose={() => setShowOptionEditor(false)}
            />
          </div>
        )}
      </div>
    );
  }

  if (property.type === "url") {
    return (
      <div className={styles.cellContent} onClick={handleCellClick}>
        {val ? (
          <a
            href={String(val).startsWith("http") ? String(val) : `https://${val}`}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.urlLink}
            onClick={(e) => e.stopPropagation()}
          >
            {String(val)}
          </a>
        ) : (
          <span style={{ color: "var(--text-muted)", fontSize: 12 }}>Empty</span>
        )}
      </div>
    );
  }

  if (property.type === "date") {
    return (
      <div className={styles.cellContent} onClick={handleCellClick}>
        {val ? (
          <span style={{ fontSize: 13, color: "var(--text-primary)" }}>
            {String(val).substring(0, 10)}
          </span>
        ) : (
          <span style={{ color: "var(--text-muted)", fontSize: 12 }}>Empty</span>
        )}
      </div>
    );
  }

  return (
    <div className={styles.cellContent} onClick={handleCellClick}>
      {formattedVal ? (
        <span style={{ fontSize: 13 }}>{formattedVal}</span>
      ) : (
        <span style={{ color: "var(--text-muted)", fontSize: 12 }}>Empty</span>
      )}
    </div>
  );
}

function SelectOptionEditorInline({
  databaseId,
  property,
  onOptionsChanged,
  onClose,
}: {
  databaseId: string;
  property: Property;
  onOptionsChanged: () => void;
  onClose: () => void;
}) {
  const [newValue, setNewValue] = useState("");
  const options = property.options || [];

  const handleAdd = useCallback(async () => {
    if (!newValue.trim()) return;
    try {
      await api.addSelectOption(databaseId, {
        propertyId: property.id,
        value: newValue.trim(),
        color: "#ecad0a",
      });
      setNewValue("");
      onOptionsChanged();
    } catch (err) {
      console.error("Failed to add option:", err);
    }
  }, [newValue, databaseId, property.id, onOptionsChanged]);

  const handleRemove = useCallback(
    async (opt: SelectOption) => {
      try {
        await api.deleteSelectOption(opt.id);
        onOptionsChanged();
      } catch (err) {
        console.error("Failed to remove option:", err);
      }
    },
    [onOptionsChanged]
  );

  return (
    <div
      style={{
        background: "var(--bg-secondary)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        padding: 12,
        minWidth: 220,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>Options</span>
        <button
          onClick={onClose}
          style={{ color: "var(--text-muted)", fontSize: 12, cursor: "pointer", background: "none", border: "none" }}
        >
          ✕
        </button>
      </div>
      {options.map((opt) => (
        <div key={opt.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 0", borderBottom: "1px solid var(--border)" }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: opt.color || "gray", flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: 12, color: "var(--text-primary)" }}>{opt.value}</span>
          <button
            onClick={() => handleRemove(opt)}
            style={{ color: "var(--text-muted)", fontSize: 10, cursor: "pointer", background: "none", border: "none", padding: "2px 4px" }}
          >
            ✕
          </button>
        </div>
      ))}
      <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
        <input
          type="text"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="Add option..."
          style={{
            flex: 1,
            background: "var(--bg-primary)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            color: "var(--text-primary)",
            fontSize: 12,
            padding: "3px 6px",
            outline: "none",
          }}
        />
        <button
          onClick={handleAdd}
          style={{
            background: "var(--amber)",
            color: "var(--bg-primary)",
            border: "none",
            borderRadius: "var(--radius-sm)",
            padding: "2px 8px",
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Add
        </button>
      </div>
    </div>
  );
}

export default function TableView({
  database,
  rows,
  onRowsChanged,
  onDatabaseChanged,
  onOpenRow,
}: TableViewProps) {
  const [showPropertyEditor, setShowPropertyEditor] = useState(false);
  const [renamingPropId, setRenamingPropId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const properties = database.properties || [];
  const titleColumn = { id: "__title", name: "Title", type: "text" as const };

  const handleCellSave = useCallback(
    async (rowId: string, propId: string, value: unknown) => {
      const row = rows.find((r) => r.id === rowId);
      if (!row) return;

      const newData = { ...((row.data as Record<string, unknown>) || {}) };
      if (value === "" || value === null) {
        delete newData[propId];
      } else {
        newData[propId] = value;
      }

      try {
        await api.updateRow(rowId, { data: newData });
        onRowsChanged();
      } catch (err) {
        console.error("Failed to save cell:", err);
      }
    },
    [rows, onRowsChanged]
  );

  const handleAddProperty = useCallback(
    async (prop: { name: string; type: Property["type"] }) => {
      const newProperty: Property = {
        id: crypto.randomUUID?.() || Math.random().toString(36).substring(2),
        name: prop.name,
        type: prop.type,
      };
      const updatedProps = [...properties, newProperty];
      try {
        const updated = await api.updateProperties(database.id, updatedProps);
        onDatabaseChanged(updated);
      } catch (err) {
        console.error("Failed to add property:", err);
      }
    },
    [database.id, properties, onDatabaseChanged]
  );

  const handleDeleteProperty = useCallback(
    async (propId: string) => {
      const updatedProps = properties.filter((p) => p.id !== propId);
      try {
        const updated = await api.updateProperties(database.id, updatedProps);
        onDatabaseChanged(updated);
      } catch (err) {
        console.error("Failed to delete property:", err);
      }
    },
    [database.id, properties, onDatabaseChanged]
  );

  const handleRenameProperty = useCallback(
    async (propId: string, newName: string) => {
      const updatedProps = properties.map((p) =>
        p.id === propId ? { ...p, name: newName } : p
      );
      try {
        const updated = await api.updateProperties(database.id, updatedProps);
        onDatabaseChanged(updated);
        setRenamingPropId(null);
      } catch (err) {
        console.error("Failed to rename property:", err);
      }
    },
    [database.id, properties, onDatabaseChanged]
  );

  const handleNewRow = useCallback(async () => {
    try {
      await api.createRow(database.id, { title: "Untitled" });
      onRowsChanged();
    } catch (err) {
      console.error("Failed to create row:", err);
    }
  }, [database.id, onRowsChanged]);

  const handleDeleteRow = useCallback(
    async (rowId: string) => {
      try {
        await api.deleteRow(rowId);
        onRowsChanged();
      } catch (err) {
        console.error("Failed to delete row:", err);
      }
    },
    [onRowsChanged]
  );

  const handleTitleChange = useCallback(
    async (row: Row, newTitle: string) => {
      try {
        await api.updateRow(row.id, { title: newTitle });
        onRowsChanged();
      } catch (err) {
        console.error("Failed to update row title:", err);
      }
    },
    [onRowsChanged]
  );

  return (
    <div className={styles.viewContainer}>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead className={styles.header}>
            <tr>
              <th
                className={styles.headerCell}
                style={{ width: 40 }}
              >
                <span className={styles.headerName}>#</span>
              </th>
              <th className={styles.headerCell} style={{ minWidth: 200 }}>
                <span className={styles.headerName}>Title</span>
              </th>
              {properties.map((prop) => (
                <th key={prop.id} className={styles.headerCell}>
                  <span className={styles.headerName}>
                    {renamingPropId === prop.id ? (
                      <input
                        className={styles.headerRename}
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={() => {
                          if (renameValue.trim() && renameValue.trim() !== prop.name) {
                            handleRenameProperty(prop.id, renameValue.trim());
                          } else {
                            setRenamingPropId(null);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.currentTarget.blur();
                          }
                          if (e.key === "Escape") {
                            setRenamingPropId(null);
                          }
                        }}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span
                        onClick={() => {
                          setRenamingPropId(prop.id);
                          setRenameValue(prop.name);
                        }}
                      >
                        {prop.name}
                      </span>
                    )}
                    <span className={styles.propertyType}>{prop.type}</span>
                  </span>
                  <div className={styles.headerActions}>
                    <button
                      className={styles.headerActionBtn}
                      onClick={() => {
                        setRenamingPropId(prop.id);
                        setRenameValue(prop.name);
                      }}
                      title="Rename"
                    >
                      ✎
                    </button>
                    <button
                      className={`${styles.headerActionBtn} ${styles.headerActionBtnDanger}`}
                      onClick={() => handleDeleteProperty(prop.id)}
                      title="Remove property"
                    >
                      ✕
                    </button>
                  </div>
                </th>
              ))}
              <th className={styles.headerCell} style={{ width: 60 }}>
                <button
                  className={styles.addColumnBtn}
                  onClick={() => setShowPropertyEditor(true)}
                  title="Add property"
                >
                  +
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={row.id} className={styles.bodyRow}>
                <td className={styles.cell} style={{ width: 40 }}>
                  <span className={styles.rowNum}>{row.index ?? idx + 1}</span>
                </td>
                <td className={styles.titleCell}>
                  <div className={styles.titleText}>
                    <span
                      className={styles.titleIcon}
                      style={{ cursor: "pointer" }}
                      onClick={() => onOpenRow(row)}
                    >
                      📄
                    </span>
                    <EditableTitle
                      title={row.title}
                      onSave={(newTitle) => handleTitleChange(row, newTitle)}
                      onClick={() => onOpenRow(row)}
                    />
                  </div>
                </td>
                {properties.map((prop) => (
                  <td key={prop.id} className={styles.cell}>
                    <CellEditor
                      row={row}
                      property={prop}
                      databaseId={database.id}
                      onSave={handleCellSave}
                      onOptionsChanged={onRowsChanged}
                    />
                  </td>
                ))}
                <td className={styles.cell} style={{ width: 40 }}>
                  <div className={styles.rowActions}>
                    <button
                      className={styles.rowActionBtn}
                      onClick={() => handleDeleteRow(row.id)}
                      title="Delete row"
                    >
                      🗑
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button className={styles.newRowBtn} onClick={handleNewRow}>
          <span>+</span>
          <span>New Row</span>
        </button>
      </div>

      <PropertyEditor
        open={showPropertyEditor}
        onClose={() => setShowPropertyEditor(false)}
        onAdd={handleAddProperty}
        existingProperties={properties}
      />
    </div>
  );
}

function EditableTitle({
  title,
  onSave,
  onClick,
}: {
  title: string;
  onSave: (val: string) => void;
  onClick: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  if (editing) {
    return (
      <input
        ref={inputRef}
        className={styles.renameInput}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => {
          if (val.trim()) onSave(val.trim());
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") setEditing(false);
        }}
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  return (
    <span
      style={{ cursor: "pointer", fontSize: 14, color: "var(--text-primary)" }}
      onClick={onClick}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setVal(title);
        setEditing(true);
      }}
    >
      {title || <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>Untitled</span>}
    </span>
  );
}
