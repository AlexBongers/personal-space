"use client";

import { useState } from "react";
import type { Item } from "./types";

type SidebarProps = {
  items: Item[];
  selectedId: string;
  expanded: Set<string>;
  mobileOpen: boolean;
  onDismiss: () => void;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onCreatePage: (parentId: string | null) => void;
  onCreateDatabase: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
};

export function Sidebar({
  items,
  selectedId,
  expanded,
  mobileOpen,
  onDismiss,
  onSelect,
  onToggle,
  onCreatePage,
  onCreateDatabase,
  onRename,
  onDelete,
}: SidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const childrenOf = (parentId: string | null) => items.filter((item) => item.parentId === parentId);

  const beginRename = (item: Item) => {
    setEditingId(item.id);
    setEditingValue(item.title);
  };

  const finishRename = () => {
    if (editingId && editingValue.trim()) onRename(editingId, editingValue.trim());
    setEditingId(null);
  };

  const chooseItem = (id: string) => {
    onSelect(id);
    onDismiss();
  };

  const renderNode = (item: Item, depth: number): React.ReactNode => {
    const children = childrenOf(item.id);
    const hasChildren = children.length > 0;
    return (
      <div key={item.id} className="tree-group">
        <div
          className={`tree-row ${selectedId === item.id ? "active" : ""}`}
          style={{ paddingLeft: `${12 + depth * 18}px` }}
        >
          <button
            className="chevron"
            aria-label={hasChildren ? (expanded.has(item.id) ? `Collapse ${item.title}` : `Expand ${item.title}`) : "No nested pages"}
            onClick={() => hasChildren && onToggle(item.id)}
          >
            {hasChildren ? (expanded.has(item.id) ? "⌄" : "›") : "·"}
          </button>
          <button className="tree-label" onClick={() => chooseItem(item.id)}>
            <span className={`tree-icon ${item.kind === "database" ? "database-icon" : ""}`}>{item.icon}</span>
            {editingId === item.id ? (
              <input
                autoFocus
                value={editingValue}
                onChange={(event) => setEditingValue(event.target.value)}
                onBlur={finishRename}
                onKeyDown={(event) => {
                  if (event.key === "Enter") finishRename();
                  if (event.key === "Escape") setEditingId(null);
                }}
                onClick={(event) => event.stopPropagation()}
              />
            ) : (
              <span>{item.title}</span>
            )}
          </button>
          <div className="tree-actions">
            {item.kind === "page" && (
              <button
                aria-label={`New page inside ${item.title}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onCreatePage(item.id);
                }}
              >＋</button>
            )}
            <button
              aria-label={`Rename ${item.title}`}
              onClick={(event) => {
                event.stopPropagation();
                beginRename(item);
              }}
            >•••</button>
            {item.id !== "home" && (
              <button
                aria-label={`Delete ${item.title}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete(item.id);
                }}
              >×</button>
            )}
          </div>
        </div>
        {expanded.has(item.id) && children.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  };

  return (
    <>
      <button
        className={`sidebar-scrim ${mobileOpen ? "visible" : ""}`}
        aria-label="Close workspace navigation"
        tabIndex={mobileOpen ? 0 : -1}
        onClick={onDismiss}
      />
      <aside className={`sidebar ${mobileOpen ? "mobile-open" : ""}`} aria-label="Workspace navigation">
        <div className="brand">
          <div className="brand-mark">P</div>
          <div><strong>Personal Space</strong><span>Private workspace</span></div>
          <button className="sidebar-close" aria-label="Close navigation" onClick={onDismiss}>×</button>
          <button className="sidebar-more" aria-label="Workspace menu">•••</button>
        </div>
        <div className="sidebar-nav">
          <button className="nav-item" onClick={() => chooseItem("home")}>
            <span className="nav-glyph">⌂</span> Home <kbd>H</kbd>
          </button>
          <button className="nav-item" onClick={() => chooseItem("search")}>
            <span className="nav-glyph">⌕</span> Quick find <kbd>⌘K</kbd>
          </button>
        </div>
        <div className="sidebar-section">
          <div className="section-heading">
            <span>Workspace</span>
            <button aria-label="New page" onClick={() => onCreatePage(null)}>＋</button>
          </div>
          <div className="tree">{childrenOf(null).map((item) => renderNode(item, 0))}</div>
        </div>
        <div className="sidebar-footer">
          <button className="new-button" onClick={() => onCreatePage(null)}><span>＋</span> New page</button>
          <button className="new-button secondary" onClick={onCreateDatabase}><span>▦</span> New database</button>
          <div className="storage-note"><span className="local-dot" /> Changes stored in this browser</div>
        </div>
      </aside>
    </>
  );
}
