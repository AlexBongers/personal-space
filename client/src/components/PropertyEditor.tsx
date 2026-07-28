import { useState, useCallback } from "react";
import type { Property } from "shared/types";
import Modal from "./Modal";

interface PropertyEditorProps {
  open: boolean;
  onClose: () => void;
  onAdd: (property: { name: string; type: Property["type"] }) => void;
  existingProperties: Property[];
}

const PROPERTY_TYPES: { type: Property["type"]; label: string }[] = [
  { type: "text", label: "Text" },
  { type: "number", label: "Number" },
  { type: "select", label: "Select" },
  { type: "multi-select", label: "Multi-select" },
  { type: "date", label: "Date" },
  { type: "checkbox", label: "Checkbox" },
  { type: "url", label: "URL" },
];

export default function PropertyEditor({ open, onClose, onAdd, existingProperties }: PropertyEditorProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<Property["type"]>("text");

  const handleSubmit = useCallback(() => {
    if (!name.trim()) return;
    onAdd({ name: name.trim(), type });
    setName("");
    setType("text");
    onClose();
  }, [name, type, onAdd, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") handleSubmit();
    },
    [handleSubmit]
  );

  const handleClose = useCallback(() => {
    setName("");
    setType("text");
    onClose();
  }, [onClose]);

  return (
    <Modal open={open} onClose={handleClose} title="Add Property"
      footer={
        <>
          <button
            onClick={handleClose}
            style={{
              padding: "8px 16px",
              borderRadius: "var(--radius-sm)",
              background: "var(--bg-tertiary)",
              color: "var(--text-secondary)",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              border: "none",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            style={{
              padding: "8px 16px",
              borderRadius: "var(--radius-sm)",
              background: "var(--amber)",
              color: "var(--bg-primary)",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              border: "none",
            }}
          >
            Add Property
          </button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Property name..."
            autoFocus
            style={{
              width: "100%",
              background: "var(--bg-primary)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              color: "var(--text-primary)",
              fontSize: 14,
              padding: "8px 12px",
              outline: "none",
            }}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>
            Type (cannot be changed later)
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {PROPERTY_TYPES.map((pt) => (
              <button
                key={pt.type}
                onClick={() => setType(pt.type)}
                style={{
                  padding: "8px 12px",
                  borderRadius: "var(--radius-sm)",
                  background: type === pt.type ? "var(--bg-hover)" : "var(--bg-tertiary)",
                  border: type === pt.type ? "1px solid var(--blue)" : "1px solid var(--border)",
                  color: type === pt.type ? "var(--text-primary)" : "var(--text-secondary)",
                  fontSize: 13,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                {pt.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
