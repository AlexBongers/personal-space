"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLanguage } from "./i18n";
import { InterfaceIcon, type IconName } from "./InterfaceIcon";
import type { Item } from "./types";

const SIDEBAR_WIDTH_KEY = "personal-space-sidebar-width";
const SIDEBAR_GROUPS_KEY = "personal-space-sidebar-groups";
/** Tasks and Calendar are reached through the Planning section, so the page tree does not list them again. */
const PLANNING_IDS = new Set(["google-tasks", "google-calendar"]);
const SIDEBAR_MIN_WIDTH = 220;
const SIDEBAR_MAX_WIDTH = 420;
const SIDEBAR_DEFAULT_WIDTH = 260;

const clampSidebarWidth = (width: number) => Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, width));

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
  /** Hides the sidebar on wide screens; the top bar has a button to bring it back. */
  onHide?: () => void;
};

type GroupId = "planning" | "inbox" | "pages";

/** A sidebar group that folds open and closed; the choice is remembered on this device. */
function NavGroup({ id, label, open, onToggle, action, children }: { id: GroupId; label: string; open: boolean; onToggle: (id: GroupId) => void; action?: ReactNode; children: ReactNode }) {
  return (
    <div className={`nav-group ${open ? "is-open" : ""}`}>
      <div className="nav-group-heading">
        <button type="button" className="nav-group-toggle" aria-expanded={open} onClick={() => onToggle(id)}>
          <span className="nav-group-chevron" aria-hidden="true">›</span>{label}
        </button>
        {action}
      </div>
      {open && <div className="nav-group-items">{children}</div>}
    </div>
  );
}

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
  onHide,
}: SidebarProps) {
  const { t } = useLanguage();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [groups, setGroups] = useState<Record<GroupId, boolean>>({ planning: true, inbox: true, pages: true });
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarWidthRef = useRef(SIDEBAR_DEFAULT_WIDTH);
  const resizeStartRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const childrenByParent = useMemo(() => {
    const grouped = new Map<string | null, Item[]>();
    items.forEach((item) => {
      const children = grouped.get(item.parentId);
      if (children) children.push(item);
      else grouped.set(item.parentId, [item]);
    });
    return grouped;
  }, [items]);
  const childrenOf = (parentId: string | null) => childrenByParent.get(parentId) || [];

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const storedWidthValue = window.localStorage.getItem(SIDEBAR_WIDTH_KEY);
        const storedWidth = storedWidthValue === null ? Number.NaN : Number(storedWidthValue);
        if (Number.isFinite(storedWidth)) {
          const nextWidth = clampSidebarWidth(storedWidth);
          sidebarWidthRef.current = nextWidth;
          setSidebarWidth(nextWidth);
        }
        const storedGroups = JSON.parse(window.localStorage.getItem(SIDEBAR_GROUPS_KEY) || "{}") as Partial<Record<GroupId, unknown>>;
        setGroups((current) => ({
          planning: typeof storedGroups.planning === "boolean" ? storedGroups.planning : current.planning,
          inbox: typeof storedGroups.inbox === "boolean" ? storedGroups.inbox : current.inbox,
          pages: typeof storedGroups.pages === "boolean" ? storedGroups.pages : current.pages,
        }));
      } catch {
        // Keep the defaults when browser preferences are unavailable.
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const toggleGroup = (id: GroupId) => setGroups((current) => {
    const next = { ...current, [id]: !current[id] };
    try { window.localStorage.setItem(SIDEBAR_GROUPS_KEY, JSON.stringify(next)); } catch { /* The choice lasts for this session. */ }
    return next;
  });

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const start = resizeStartRef.current;
      if (!start) return;
      const nextWidth = clampSidebarWidth(start.startWidth + event.clientX - start.startX);
      sidebarWidthRef.current = nextWidth;
      setSidebarWidth(nextWidth);
    };
    const finishResize = () => {
      if (resizeStartRef.current === null) return;
      resizeStartRef.current = null;
      setIsResizing(false);
      try {
        window.localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidthRef.current));
      } catch {
        // The resized width remains active for this session.
      }
    };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", finishResize);
    window.addEventListener("pointercancel", finishResize);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishResize);
      window.removeEventListener("pointercancel", finishResize);
    };
  }, []);

  const resizeWithKeyboard = (nextWidth: number) => {
    const clampedWidth = clampSidebarWidth(nextWidth);
    sidebarWidthRef.current = clampedWidth;
    setSidebarWidth(clampedWidth);
    try {
      window.localStorage.setItem(SIDEBAR_WIDTH_KEY, String(clampedWidth));
    } catch {
      // The resized width remains active for this session.
    }
  };

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

  const navButton = (id: string, icon: IconName, label: string, shortcut?: string, current = selectedId === id) => (
    <button className="nav-item" aria-current={current ? "page" : undefined} onClick={() => chooseItem(id)}>
      <span className="nav-glyph"><InterfaceIcon name={icon} /></span>{label}{shortcut && <kbd>{shortcut}</kbd>}
    </button>
  );
  const hasTasks = items.some((item) => item.id === "google-tasks");
  const hasCalendar = items.some((item) => item.id === "google-calendar");

  return (
    <>
      <button
        className={`sidebar-scrim ${mobileOpen ? "visible" : ""}`}
        aria-label={t("nav.closeNavigation")}
        tabIndex={mobileOpen ? 0 : -1}
        onClick={onDismiss}
      />
      <aside
        className={`sidebar ${mobileOpen ? "mobile-open" : ""} ${isResizing ? "sidebar-resizing" : ""}`}
        style={{ "--sidebar-width": `${sidebarWidth}px` } as React.CSSProperties}
        aria-label={t("nav.workspaceNavigation")}
      >
        <div className="sidebar-top">
          <button className="sidebar-close" aria-label={t("nav.closeNavigation")} onClick={onDismiss}>×</button>
          {onHide && <button type="button" className="sidebar-hide" aria-label={t("nav.hideSidebar")} title={`${t("nav.hideSidebar")} (⌘\\)`} onClick={onHide}><InterfaceIcon name="sidebar" /></button>}
        </div>
        <div className="sidebar-scroll">
          <div className="nav-group-items">
            {navButton("home", "home", t("nav.home"), "H")}
            <button className="nav-item" onClick={() => chooseItem("search")}>
              <span className="nav-glyph"><InterfaceIcon name="search" /></span>{t("nav.quickFind")}<kbd>⌘K</kbd>
            </button>
          </div>
          {(hasTasks || hasCalendar) && (
            <NavGroup id="planning" label={t("nav.sectionPlanning")} open={groups.planning} onToggle={toggleGroup}>
              {hasTasks && navButton("google-tasks", "tasks", t("nav.googleTasks"))}
              {hasCalendar && navButton("google-calendar", "calendar", t("nav.googleCalendar"))}
            </NavGroup>
          )}
          <NavGroup id="inbox" label={t("nav.sectionInbox")} open={groups.inbox} onToggle={toggleGroup}>
            {navButton("gmail", "mail", t("nav.gmail"))}
            {navButton("parro", "mail", t("nav.parro"))}
            {navButton(selectedId.startsWith("news-") ? selectedId : "news-tweakers", "news", t("nav.news"), undefined, selectedId.startsWith("news-"))}
          </NavGroup>
          <NavGroup id="pages" label={t("nav.workspace")} open={groups.pages} onToggle={toggleGroup}
            action={<button type="button" className="nav-group-add" aria-label={t("nav.newPage")} onClick={() => onCreatePage(null)}>＋</button>}>
            <div className="tree">{childrenOf(null).filter((item) => !PLANNING_IDS.has(item.id)).map((item) => renderNode(item, 0))}</div>
          </NavGroup>
        </div>
        <div className="sidebar-footer">
          <button className="new-button" onClick={() => onCreatePage(null)}><InterfaceIcon name="plus" /> {t("nav.newPage")}</button>
          <button className="new-button secondary" onClick={onCreateDatabase}><InterfaceIcon name="database" /> {t("nav.newDatabase")}</button>
        </div>
        <div
          className="sidebar-resize"
          role="separator"
          tabIndex={0}
          aria-label={t("nav.resizeSidebar")}
          aria-valuemin={SIDEBAR_MIN_WIDTH}
          aria-valuemax={SIDEBAR_MAX_WIDTH}
          aria-valuenow={sidebarWidth}
          onPointerDown={(event) => {
            event.preventDefault();
            resizeStartRef.current = { startX: event.clientX, startWidth: sidebarWidthRef.current };
            setIsResizing(true);
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") { event.preventDefault(); resizeWithKeyboard(sidebarWidth - 16); }
            if (event.key === "ArrowRight") { event.preventDefault(); resizeWithKeyboard(sidebarWidth + 16); }
            if (event.key === "Home") { event.preventDefault(); resizeWithKeyboard(SIDEBAR_MIN_WIDTH); }
            if (event.key === "End") { event.preventDefault(); resizeWithKeyboard(SIDEBAR_MAX_WIDTH); }
          }}
        />
      </aside>
    </>
  );
}
