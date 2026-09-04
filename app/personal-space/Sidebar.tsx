"use client";

import { useState } from "react";
import { useLanguage } from "./i18n";
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
  const { t } = useLanguage();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [workspaceOpen, setWorkspaceOpen] = useState(true);
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
            aria-label={hasChildren ? (expanded.has(item.id) ? t("nav.collapse", { title: item.title }) : t("nav.expand", { title: item.title })) : t("nav.noNestedPages")}
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
                aria-label={t("nav.newPageInside", { title: item.title })}
                onClick={(event) => {
                  event.stopPropagation();
                  onCreatePage(item.id);
                }}
              >＋</button>
            )}
            <button
              aria-label={t("nav.rename", { title: item.title })}
              onClick={(event) => {
                event.stopPropagation();
                beginRename(item);
              }}
            >•••</button>
            {item.id !== "home" && (
              <button
                aria-label={t("nav.delete", { title: item.title })}
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
        aria-label={t("nav.closeNavigation")}
        tabIndex={mobileOpen ? 0 : -1}
        onClick={onDismiss}
      />
      <aside className={`sidebar ${mobileOpen ? "mobile-open" : ""}`} aria-label={t("nav.workspaceNavigation")}>
        <div className="brand">
          <div className="brand-mark">P</div>
          <div><strong>Personal Space</strong></div>
          <button className="sidebar-close" aria-label={t("nav.closeNavigation")} onClick={onDismiss}>×</button>
        </div>
        <div className="sidebar-nav">
          <button className="nav-item" onClick={() => chooseItem("home")}>
            <span className="nav-glyph">⌂</span> {t("nav.home")} <kbd>H</kbd>
          </button>
          <button className="nav-item" onClick={() => chooseItem("search")}>
            <span className="nav-glyph">⌕</span> {t("nav.quickFind")} <kbd>⌘K</kbd>
          </button>
        </div>
        <div className="sidebar-section">
          <div className="section-heading">
            <button
              className="section-toggle"
              aria-expanded={workspaceOpen}
              aria-label={workspaceOpen ? t("nav.collapseWorkspace") : t("nav.expandWorkspace")}
              onClick={() => setWorkspaceOpen((open) => !open)}
            >{workspaceOpen ? "⌄" : "›"}</button>
            <span>{t("nav.workspace")}</span>
            <button aria-label={t("nav.newPage")} onClick={() => onCreatePage(null)}>＋</button>
          </div>
          {workspaceOpen && <div className="tree">{childrenOf(null).map((item) => renderNode(item, 0))}</div>}
        </div>
        <div className="sidebar-footer">
          <button className="new-button" onClick={() => onCreatePage(null)}><span>＋</span> {t("nav.newPage")}</button>
          <button className="new-button secondary" onClick={onCreateDatabase}><span>▦</span> {t("nav.newDatabase")}</button>
        </div>
      </aside>
    </>
  );
}
