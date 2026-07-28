import { useState, useCallback } from "react";
import type { Database, Row, Property, SelectOption } from "shared/types";
import * as api from "../api";
import styles from "./BoardView.module.css";

interface BoardViewProps {
  database: Database;
  rows: Row[];
  groupField: string | null;
  onRowsChanged: () => void;
  onOpenRow: (row: Row) => void;
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

function getRowValue(row: Row, propId: string): string {
  if (!row.data || typeof row.data !== "object") return "";
  const val = (row.data as Record<string, unknown>)[propId];
  if (val === null || val === undefined) return "";
  return String(val);
}

function CardPriorityBadge({ row, properties }: { row: Row; properties: Property[] }) {
  const priorityProp = properties.find(
    (p) => p.type === "select" && p.name.toLowerCase().includes("priorit")
  );
  if (!priorityProp) return null;
  const val = getRowValue(row, priorityProp.id);
  if (!val) return null;
  const opt = findOption(priorityProp.options, val);
  return (
    <span
      className={styles.cardBadge}
      style={{
        backgroundColor: opt?.color ? `${opt.color}22` : "rgba(236,173,10,0.15)",
        color: opt?.color || "var(--amber)",
      }}
    >
      {opt?.value || val}
    </span>
  );
}

function CardDateBadge({ row, properties }: { row: Row; properties: Property[] }) {
  const dateProps = properties.filter((p) => p.type === "date");
  if (dateProps.length === 0) return null;
  const prop = dateProps[0];
  const val = getRowValue(row, prop.id);
  if (!val) return null;
  const display = val.length > 10 ? val.substring(0, 10) : val;
  return (
    <span className={`${styles.cardBadge} ${styles.cardBadgeDate}`}>
      {display}
    </span>
  );
}

interface CardProps {
  row: Row;
  properties: Property[];
  onOpenRow: (row: Row) => void;
}

function BoardCard({ row, properties, onOpenRow }: CardProps) {
  const [dragging, setDragging] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);

  const handleDragStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;
    setDragging(true);
    setPosition({ x: e.clientX - offsetX, y: e.clientY - offsetY });

    const originalEl = e.currentTarget as HTMLElement;
    originalEl.dataset.dragCardId = row.id;
    originalEl.dataset.dragOffsetX = String(offsetX);
    originalEl.dataset.dragOffsetY = String(offsetY);

    const handleMove = (moveEvent: PointerEvent) => {
      setPosition({ x: moveEvent.clientX - offsetX, y: moveEvent.clientY - offsetY });
      const elBelow = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
      if (elBelow) {
        const column = elBelow.closest('[data-column-id]');
        document.querySelectorAll('[data-column-id]').forEach((col) => {
          (col as HTMLElement).classList.remove(styles.columnDroppableOver);
        });
        if (column) {
          (column as HTMLElement).classList.add(styles.columnDroppableOver);
        }
      }
    };

    const handleUp = (upEvent: PointerEvent) => {
      document.removeEventListener("pointermove", handleMove);
      document.removeEventListener("pointerup", handleUp);
      setDragging(false);
      setPosition(null);

      document.querySelectorAll('[data-column-id]').forEach((col) => {
        (col as HTMLElement).classList.remove(styles.columnDroppableOver);
      });

      const elBelow = document.elementFromPoint(upEvent.clientX, upEvent.clientY);
      if (elBelow) {
        const column = elBelow.closest('[data-column-id]');
        if (column) {
          const targetColId = (column as HTMLElement).dataset.columnId;
          if (targetColId) {
            const dropEvent = new CustomEvent("card-drop", {
              detail: { cardId: row.id, targetColumnValue: targetColId },
              bubbles: true,
            });
            elBelow.dispatchEvent(dropEvent);
          }
        }
      }
    };

    document.addEventListener("pointermove", handleMove);
    document.addEventListener("pointerup", handleUp);
  }, [row.id]);

  const handleClick = useCallback(() => {
    onOpenRow(row);
  }, [onOpenRow, row]);

  return (
    <>
      <div
        className={`${styles.card} ${dragging ? styles.cardDragging : ""}`}
        onPointerDown={handleDragStart}
        onClick={handleClick}
        style={{ touchAction: "none" }}
      >
        <span className={styles.cardTitle}>{row.title || "Untitled"}</span>
        <div className={styles.cardProperties}>
          <CardPriorityBadge row={row} properties={properties} />
          <CardDateBadge row={row} properties={properties} />
        </div>
      </div>
      {dragging && position && (
        <div
          style={{
            position: "fixed",
            zIndex: 1000,
            pointerEvents: "none",
            left: position.x,
            top: position.y,
            width: 260,
            opacity: 0.9,
          }}
          className={`${styles.card} ${styles.cardDragging}`}
        >
          <span className={styles.cardTitle}>{row.title || "Untitled"}</span>
        </div>
      )}
    </>
  );
}

export default function BoardView({
  database,
  rows,
  groupField,
  onRowsChanged,
  onOpenRow,
}: BoardViewProps) {
  const properties = database.properties || [];

  const groupProp = groupField
    ? properties.find((p) => p.id === groupField)
    : undefined;

  if (!groupProp || (groupProp.type !== "select" && groupProp.type !== "multi-select")) {
    return (
      <div className={styles.noGroupField}>
        Choose a Select or Multi-select property to group by in Board view settings.
      </div>
    );
  }

  const options = groupProp.options || [];
  const columns = options.map((opt) => ({
    option: opt,
    rows: rows.filter((row) => {
      const val = getRowValue(row, groupProp.id);
      if (groupProp.type === "select") {
        return val === opt.value;
      }
      const vals = val ? val.split(",").map((v) => v.trim()) : [];
      return vals.includes(opt.value);
    }),
  }));

  columns.push({
    option: { id: "__none", value: "No Status", color: "#6b6b80" },
    rows: rows.filter((row) => {
      const val = getRowValue(row, groupProp.id);
      if (!val) return true;
      if (groupProp.type === "select") {
        return !options.some((o) => o.value === val);
      }
      const vals = val.split(",").map((v) => v.trim()).filter(Boolean);
      return vals.length === 0 || vals.every((v) => !options.some((o) => o.value === v));
    }),
  });

  const handleDrop = useCallback(
    async (e: Event) => {
      const customEvent = e as CustomEvent;
      const { cardId, targetColumnValue } = customEvent.detail;

      const row = rows.find((r) => r.id === cardId);
      if (!row) return;

      const currentVal = getRowValue(row, groupProp.id);

      if (groupProp.type === "select") {
        if (currentVal === targetColumnValue) return;
        if (targetColumnValue === "__none") {
          const newData = { ...((row.data as Record<string, unknown>) || {}) };
          delete newData[groupProp.id];
          try {
            await api.updateRow(row.id, { data: newData });
            onRowsChanged();
          } catch (err) {
            console.error("Failed to update row:", err);
          }
        } else {
          const newData = { ...((row.data as Record<string, unknown>) || {}), [groupProp.id]: targetColumnValue };
          try {
            await api.updateRow(row.id, { data: newData });
            onRowsChanged();
          } catch (err) {
            console.error("Failed to update row:", err);
          }
        }
      } else {
        const vals = currentVal ? currentVal.split(",").map((v) => v.trim()).filter(Boolean) : [];
        if (targetColumnValue === "__none") {
          const cleanedVals = vals.filter((v) => !options.some((o) => o.value === v));
          const newData = { ...((row.data as Record<string, unknown>) || {}), [groupProp.id]: cleanedVals };
          try {
            await api.updateRow(row.id, { data: newData });
            onRowsChanged();
          } catch (err) {
            console.error("Failed to update row:", err);
          }
        } else {
          if (!vals.includes(targetColumnValue)) {
            vals.push(targetColumnValue);
          }
          const newData = { ...((row.data as Record<string, unknown>) || {}), [groupProp.id]: vals };
          try {
            await api.updateRow(row.id, { data: newData });
            onRowsChanged();
          } catch (err) {
            console.error("Failed to update row:", err);
          }
        }
      }
    },
    [rows, groupProp, options, onRowsChanged]
  );

  const boardRef = useCallback(
    (el: HTMLDivElement | null) => {
      if (!el) return;
      const handler = (e: Event) => handleDrop(e);
      el.addEventListener("card-drop", handler);
      return () => el.removeEventListener("card-drop", handler);
    },
    [handleDrop]
  );

  return (
    <div className={styles.boardContainer} ref={boardRef}>
      {columns.map((col) => (
        <div
          key={col.option.id}
          className={`${styles.columnDroppable}`}
          data-column-id={col.option.value}
        >
          <div className={styles.column}>
            <div className={styles.columnHeader}>
              <span
                className={styles.columnDot}
                style={{ backgroundColor: col.option.color || "gray" }}
              />
              <span>{col.option.value}</span>
              <span className={styles.columnCount}>{col.rows.length}</span>
            </div>
            <div
              className={`${styles.columnBody} ${col.rows.length === 0 ? styles.columnBodyEmpty : ""}`}
            >
              {col.rows.length > 0 ? (
                col.rows.map((row) => (
                  <BoardCard
                    key={row.id}
                    row={row}
                    properties={properties}
                    onOpenRow={onOpenRow}
                  />
                ))
              ) : (
                <span>Drop cards here</span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
