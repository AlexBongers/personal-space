import { useState, useCallback } from "react";
import type { Property, SelectOption } from "shared/types";
import * as api from "../api";
import styles from "./TableView.module.css";

interface SelectOptionEditorProps {
  databaseId: string;
  property: Property;
  onOptionsChanged: () => void;
  onClose: () => void;
}

const COLORS = [
  "gray", "#ecad0a", "#209dd7", "#753991", "#e5484d",
  "#30a46c", "#f76808", "#8e4ec6", "#0090ff", "#c1c8cd",
];

export default function SelectOptionEditor({
  databaseId,
  property,
  onOptionsChanged,
  onClose,
}: SelectOptionEditorProps) {
  const [newValue, setNewValue] = useState("");
  const [newColor, setNewColor] = useState(COLORS[1]);
  const options = property.options || [];

  const handleAdd = useCallback(async () => {
    if (!newValue.trim()) return;
    try {
      await api.addSelectOption(databaseId, {
        propertyId: property.id,
        value: newValue.trim(),
        color: newColor,
      });
      setNewValue("");
      onOptionsChanged();
    } catch (err) {
      console.error("Failed to add option:", err);
    }
  }, [newValue, newColor, databaseId, property.id, onOptionsChanged]);

  const handleRemove = useCallback(
    async (option: SelectOption) => {
      try {
        await api.deleteSelectOption(option.id);
        onOptionsChanged();
      } catch (err) {
        console.error("Failed to remove option:", err);
      }
    },
    [onOptionsChanged]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleAdd();
      }
    },
    [handleAdd]
  );

  return (
    <div
      style={{
        background: "var(--bg-secondary)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        padding: 16,
        minWidth: 260,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
          Options for {property.name}
        </span>
        <button
          onClick={onClose}
          style={{
            fontSize: 14,
            color: "var(--text-muted)",
            cursor: "pointer",
            background: "none",
            border: "none",
            padding: "2px 6px",
          }}
        >
          ✕
        </button>
      </div>

      <div style={{ marginBottom: 12 }}>
        {options.length === 0 && (
          <div style={{ fontSize: 12, color: "var(--text-muted)", padding: "8px 0" }}>
            No options yet. Add one below.
          </div>
        )}
        {options.map((option) => (
          <div
            key={option.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 0",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                backgroundColor: option.color || "gray",
                flexShrink: 0,
              }}
            />
            <span style={{ flex: 1, fontSize: 13, color: "var(--text-primary)" }}>
              {option.value}
            </span>
            <button
              onClick={() => handleRemove(option)}
              style={{
                color: "var(--text-muted)",
                cursor: "pointer",
                background: "none",
                border: "none",
                fontSize: 12,
                padding: "2px 6px",
              }}
              title="Remove option"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          type="text"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Option name..."
          style={{
            flex: 1,
            background: "var(--bg-primary)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            color: "var(--text-primary)",
            fontSize: 13,
            padding: "4px 8px",
            outline: "none",
          }}
        />
        <div style={{ display: "flex", gap: 2 }}>
          {COLORS.map((color) => (
            <button
              key={color}
              onClick={() => setNewColor(color)}
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                backgroundColor: color,
                border: newColor === color ? "2px solid white" : "2px solid transparent",
                cursor: "pointer",
              }}
              title={color}
            />
          ))}
        </div>
        <button
          onClick={handleAdd}
          style={{
            background: "var(--amber)",
            color: "var(--bg-primary)",
            border: "none",
            borderRadius: "var(--radius-sm)",
            padding: "4px 10px",
            fontSize: 12,
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
