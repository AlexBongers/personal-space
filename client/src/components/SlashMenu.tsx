import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import type { Block } from "shared/types";
import styles from "./Editor.module.css";

interface MenuItem {
  type: Block["type"];
  label: string;
  icon: string;
  desc: string;
}

const BLOCK_TYPES: MenuItem[] = [
  { type: "paragraph", label: "Paragraph", icon: "¶", desc: "Plain text" },
  { type: "heading1", label: "Heading 1", icon: "H1", desc: "Large heading" },
  { type: "heading2", label: "Heading 2", icon: "H2", desc: "Medium heading" },
  { type: "heading3", label: "Heading 3", icon: "H3", desc: "Small heading" },
  { type: "bulleted_list", label: "Bulleted List", icon: "•", desc: "Bullet points" },
  { type: "numbered_list", label: "Numbered List", icon: "1.", desc: "Ordered list" },
  { type: "todo", label: "To-do", icon: "☐", desc: "Checkbox item" },
  { type: "quote", label: "Quote", icon: "❞", desc: "Quoted text" },
  { type: "divider", label: "Divider", icon: "—", desc: "Horizontal line" },
  { type: "code", label: "Code", icon: "</>", desc: "Code block" },
  { type: "callout", label: "Callout", icon: "💡", desc: "Highlighted note" },
];

interface SlashMenuProps {
  filter: string;
  onSelect: (type: Block["type"]) => void;
  onClose: () => void;
  anchorEl: HTMLElement | null;
}

export default function SlashMenu({ filter, onSelect, onClose, anchorEl }: SlashMenuProps) {
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });

  const items = useMemo(() => {
    const q = filter.toLowerCase();
    if (!q) return BLOCK_TYPES;
    return BLOCK_TYPES.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.type.toLowerCase().includes(q) ||
        item.desc.toLowerCase().includes(q)
    );
  }, [filter]);

  const clampedIndex = Math.min(highlightedIndex, Math.max(0, items.length - 1));

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightedIndex((prev) => Math.min(prev + 1, items.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (items[clampedIndex]) {
            onSelect(items[clampedIndex].type);
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [items, clampedIndex, onSelect, onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [handleKeyDown]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [filter]);

  useEffect(() => {
    if (anchorEl) {
      const rect = anchorEl.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
      });
    }
  }, [anchorEl]);

  useEffect(() => {
    const itemEl = menuRef.current?.querySelector(
      `[data-slash-index="${clampedIndex}"]`
    );
    if (itemEl) {
      itemEl.scrollIntoView({ block: "nearest" });
    }
  }, [clampedIndex]);

  return (
    <div className={styles.slashMenuOverlay} onMouseDown={onClose}>
      <div
        className={styles.slashMenu}
        ref={menuRef}
        style={{ top: menuPosition.top, left: menuPosition.left }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {items.length === 0 ? (
          <div className={styles.slashMenuEmpty}>No results</div>
        ) : (
          items.map((item, index) => (
            <button
              key={item.type}
              className={`${styles.slashMenuItem} ${
                index === clampedIndex ? styles.slashMenuItemHighlighted : ""
              }`}
              data-slash-index={index}
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(item.type);
              }}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              <span className={styles.slashMenuItemIcon}>{item.icon}</span>
              <span className={styles.slashMenuItemLabel}>{item.label}</span>
              <span className={styles.slashMenuItemType}>{item.desc}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
