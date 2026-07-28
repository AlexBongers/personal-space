import type { Database, Row, Property, SelectOption } from "shared/types";

interface ListViewProps {
  database: Database;
  rows: Row[];
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

function formatCellValue(val: unknown, prop: Property): string {
  if (val === null || val === undefined || val === "") return "";
  if (prop.type === "checkbox") return val ? "Yes" : "No";
  if (prop.type === "date" && typeof val === "string") return val.substring(0, 10);
  if (Array.isArray(val)) return val.join(", ");
  return String(val);
}

function PropertyBadge({ val, prop }: { val: unknown; prop: Property }) {
  if (val === null || val === undefined || val === "" || val === false) return null;

  if (prop.type === "select") {
    const opt = findOption(prop.options, String(val));
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          padding: "1px 8px",
          borderRadius: 3,
          fontSize: 11,
          fontWeight: 500,
          backgroundColor: opt?.color || "var(--bg-hover)",
          color: opt ? getContrastColor(opt.color) : "var(--text-secondary)",
        }}
      >
        {opt?.value || String(val)}
      </span>
    );
  }

  if (prop.type === "multi-select") {
    const vals = Array.isArray(val) ? val : String(val).split(",").map((v) => v.trim()).filter(Boolean);
    return (
      <>
        {vals.map((v) => {
          const opt = findOption(prop.options, v);
          return (
            <span
              key={v}
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "1px 6px",
                borderRadius: 3,
                fontSize: 11,
                fontWeight: 500,
                backgroundColor: opt?.color || "var(--bg-hover)",
                color: opt ? getContrastColor(opt.color) : "var(--text-secondary)",
              }}
            >
              {opt?.value || v}
            </span>
          );
        })}
      </>
    );
  }

  if (prop.type === "checkbox") {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          padding: "1px 8px",
          borderRadius: 3,
          fontSize: 11,
          fontWeight: 500,
          backgroundColor: "var(--amber)",
          color: "var(--bg-primary)",
        }}
      >
        ✓
      </span>
    );
  }

  if (prop.type === "date") {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          padding: "1px 8px",
          borderRadius: 3,
          fontSize: 11,
          fontWeight: 500,
          backgroundColor: "var(--bg-hover)",
          color: "var(--text-secondary)",
        }}
      >
        {typeof val === "string" ? val.substring(0, 10) : String(val)}
      </span>
    );
  }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "1px 8px",
        borderRadius: 3,
        fontSize: 11,
        fontWeight: 500,
        backgroundColor: "var(--bg-hover)",
        color: "var(--text-secondary)",
      }}
    >
      {formatCellValue(val, prop)}
    </span>
  );
}

export default function ListView({ database, rows, onOpenRow }: ListViewProps) {
  const properties = (database.properties || [])
    .filter((p) => p.type !== "multi-select")
    .slice(0, 2);

  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "8px 16px 16px",
      }}
    >
      {rows.map((row, idx) => (
        <div
          key={row.id}
          onClick={() => onOpenRow(row)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "10px 16px",
            borderRadius: "var(--radius-sm)",
            cursor: "pointer",
            transition: "background 0.1s",
            borderBottom: "1px solid var(--border)",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
          }}
        >
          <span
            style={{
              color: "var(--text-muted)",
              fontSize: 11,
              fontWeight: 500,
              minWidth: 24,
              flexShrink: 0,
            }}
          >
            {row.index ?? idx + 1}
          </span>

          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              flex: 1,
              minWidth: 0,
            }}
          >
            <span style={{ fontSize: 12, opacity: 0.5, flexShrink: 0 }}>📄</span>
            <span
              style={{
                fontSize: 14,
                fontWeight: 500,
                color: "var(--text-primary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {row.title || "Untitled"}
            </span>
          </span>

          <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
            {properties.map((prop) => {
              const val = row.data ? (row.data as Record<string, unknown>)[prop.id] : undefined;
              return <PropertyBadge key={prop.id} val={val} prop={prop} />;
            })}
          </div>
        </div>
      ))}

      {rows.length === 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 48,
            color: "var(--text-muted)",
            fontSize: 13,
          }}
        >
          No rows to display
        </div>
      )}
    </div>
  );
}
