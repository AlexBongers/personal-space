import type { View } from "shared/types";

interface ViewSwitcherProps {
  views: View[];
  activeViewId: string | null;
  onSwitchView: (view: View) => void;
}

const typeIcons: Record<View["type"], string> = {
  table: "⊞",
  board: "⊟",
  list: "☰",
};

export default function ViewSwitcher({ views, activeViewId, onSwitchView }: ViewSwitcherProps) {
  if (views.length === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        gap: 2,
        borderBottom: "1px solid var(--border)",
        padding: "0 16px",
        flexShrink: 0,
      }}
    >
      {views.map((view) => {
        const isActive = view.id === activeViewId;
        return (
          <button
            key={view.id}
            onClick={() => onSwitchView(view)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 500,
              color: isActive ? "var(--amber)" : "var(--text-muted)",
              borderBottom: isActive ? "2px solid var(--amber)" : "2px solid transparent",
              background: "none",
              cursor: "pointer",
              transition: "color 0.15s, border-color 0.15s",
              marginBottom: -1,
            }}
          >
            <span style={{ fontSize: 14 }}>{typeIcons[view.type]}</span>
            <span>{view.name}</span>
          </button>
        );
      })}
    </div>
  );
}
