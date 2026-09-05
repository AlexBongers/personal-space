"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "./i18n";
import { InterfaceIcon } from "./InterfaceIcon";
import type { Item } from "./types";

const SIDEBAR_WIDTH_KEY = "personal-space-sidebar-width";
const SIDEBAR_NAV_HEIGHT_KEY = "personal-space-sidebar-nav-height";
const SIDEBAR_MIN_WIDTH = 220;
const SIDEBAR_MAX_WIDTH = 420;
const SIDEBAR_DEFAULT_WIDTH = 272;
const SIDEBAR_NAV_MIN_HEIGHT = 180;
const SIDEBAR_NAV_MAX_HEIGHT = 620;
const SIDEBAR_NAV_DEFAULT_HEIGHT = 472;

const clampSidebarWidth = (width: number) => Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, width));
const clampSidebarNavHeight = (height: number) => Math.min(SIDEBAR_NAV_MAX_HEIGHT, Math.max(SIDEBAR_NAV_MIN_HEIGHT, height));

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
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT_WIDTH);
  const [sidebarNavHeight, setSidebarNavHeight] = useState(SIDEBAR_NAV_DEFAULT_HEIGHT);
  const [isResizing, setIsResizing] = useState(false);
  const [isResizingNav, setIsResizingNav] = useState(false);
  const sidebarWidthRef = useRef(SIDEBAR_DEFAULT_WIDTH);
  const sidebarNavHeightRef = useRef(SIDEBAR_NAV_DEFAULT_HEIGHT);
  const resizeStartRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const navResizeStartRef = useRef<{ startY: number; startHeight: number } | null>(null);
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

        const storedNavHeightValue = window.localStorage.getItem(SIDEBAR_NAV_HEIGHT_KEY);
        const storedNavHeight = storedNavHeightValue === null ? Number.NaN : Number(storedNavHeightValue);
        if (Number.isFinite(storedNavHeight)) {
          const nextNavHeight = clampSidebarNavHeight(storedNavHeight);
          sidebarNavHeightRef.current = nextNavHeight;
          setSidebarNavHeight(nextNavHeight);
        }
      } catch {
        // Keep the defaults when browser preferences are unavailable.
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const start = resizeStartRef.current;
      if (start) {
        const nextWidth = clampSidebarWidth(start.startWidth + event.clientX - start.startX);
        sidebarWidthRef.current = nextWidth;
        setSidebarWidth(nextWidth);
      }

      const navStart = navResizeStartRef.current;
      if (navStart) {
        const nextNavHeight = clampSidebarNavHeight(navStart.startHeight + event.clientY - navStart.startY);
        sidebarNavHeightRef.current = nextNavHeight;
        setSidebarNavHeight(nextNavHeight);
      }
    };
    const finishResize = () => {
      const wasResizingWidth = resizeStartRef.current !== null;
      const wasResizingNav = navResizeStartRef.current !== null;
      if (!wasResizingWidth && !wasResizingNav) return;
      resizeStartRef.current = null;
      navResizeStartRef.current = null;
      setIsResizing(false);
      setIsResizingNav(false);
      try {
        if (wasResizingWidth) {
          window.localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidthRef.current));
        }
        if (wasResizingNav) {
          window.localStorage.setItem(SIDEBAR_NAV_HEIGHT_KEY, String(sidebarNavHeightRef.current));
        }
      } catch {
        // The resized dimensions remain active for this session.
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

  const resizeNavWithKeyboard = (nextHeight: number) => {
    const clampedHeight = clampSidebarNavHeight(nextHeight);
    sidebarNavHeightRef.current = clampedHeight;
    setSidebarNavHeight(clampedHeight);
    try {
      window.localStorage.setItem(SIDEBAR_NAV_HEIGHT_KEY, String(clampedHeight));
    } catch {
      // The resized navigation height remains active for this session.
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

  return (
    <>
      <button
        className={`sidebar-scrim ${mobileOpen ? "visible" : ""}`}
        aria-label={t("nav.closeNavigation")}
        tabIndex={mobileOpen ? 0 : -1}
        onClick={onDismiss}
      />
      <aside
        className={`sidebar ${mobileOpen ? "mobile-open" : ""} ${isResizing ? "sidebar-resizing" : ""} ${isResizingNav ? "sidebar-nav-resizing" : ""}`}
        style={{ "--sidebar-width": `${sidebarWidth}px`, "--sidebar-nav-height": `${sidebarNavHeight}px` } as React.CSSProperties}
        aria-label={t("nav.workspaceNavigation")}
      >
        <button className="sidebar-close" aria-label={t("nav.closeNavigation")} onClick={onDismiss}>×</button>
        <div className="sidebar-nav">
          <button className="nav-item" aria-current={selectedId === "home" ? "page" : undefined} onClick={() => chooseItem("home")}>
            <span className="nav-glyph"><InterfaceIcon name="home" /></span> {t("nav.home")} <kbd>H</kbd>
          </button>
          <button className="nav-item" onClick={() => chooseItem("search")}>
            <span className="nav-glyph"><InterfaceIcon name="search" /></span> {t("nav.quickFind")} <kbd>⌘K</kbd>
          </button>
          {items.some((item) => item.id === "google-tasks") && (
            <button className="nav-item" aria-current={selectedId === "google-tasks" ? "page" : undefined} onClick={() => chooseItem("google-tasks")}>
              <span className="nav-glyph"><InterfaceIcon name="tasks" /></span> {t("nav.googleTasks")}
            </button>
          )}
          {items.some((item) => item.id === "google-calendar") && (
            <button className="nav-item" aria-current={selectedId === "google-calendar" ? "page" : undefined} onClick={() => chooseItem("google-calendar")}>
              <span className="nav-glyph"><InterfaceIcon name="calendar" /></span> {t("nav.googleCalendar")}
            </button>
          )}
          <button className="nav-item" aria-current={selectedId === "gmail" ? "page" : undefined} onClick={() => chooseItem("gmail")}><span className="nav-glyph"><InterfaceIcon name="mail" /></span>{t("gmail.title")}</button>
          <button className="nav-item" aria-current={selectedId === "parro" ? "page" : undefined} onClick={() => chooseItem("parro")}><span className="nav-glyph"><InterfaceIcon name="mail" /></span>{t("nav.parro")}</button>
          <button className="nav-item" aria-current={selectedId === "news-slashdot" ? "page" : undefined} onClick={() => chooseItem("news-slashdot")}><span className="nav-glyph"><InterfaceIcon name="news" /></span>Slashdot</button>
          <button className="nav-item" aria-current={selectedId === "news-tweakers" ? "page" : undefined} onClick={() => chooseItem("news-tweakers")}><span className="nav-glyph"><InterfaceIcon name="news" /></span>Tweakers</button>
          <button className="nav-item" aria-current={selectedId === "news-nos" ? "page" : undefined} onClick={() => chooseItem("news-nos")}><span className="nav-glyph"><InterfaceIcon name="news" /></span>NOS</button>
          <button className="nav-item" aria-current={selectedId === "news-bunniksnieuws" ? "page" : undefined} onClick={() => chooseItem("news-bunniksnieuws")}><span className="nav-glyph"><InterfaceIcon name="news" /></span>Bunniks Nieuws</button>
        </div>
        <div
          className="sidebar-section-resize"
          role="separator"
          aria-orientation="horizontal"
          tabIndex={0}
          aria-label={t("nav.resizeSidebarNav")}
          aria-valuemin={SIDEBAR_NAV_MIN_HEIGHT}
          aria-valuemax={SIDEBAR_NAV_MAX_HEIGHT}
          aria-valuenow={sidebarNavHeight}
          onPointerDown={(event) => {
            event.preventDefault();
            navResizeStartRef.current = { startY: event.clientY, startHeight: sidebarNavHeightRef.current };
            setIsResizingNav(true);
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowUp") {
              event.preventDefault();
              resizeNavWithKeyboard(sidebarNavHeight - 16);
            }
            if (event.key === "ArrowDown") {
              event.preventDefault();
              resizeNavWithKeyboard(sidebarNavHeight + 16);
            }
            if (event.key === "Home") {
              event.preventDefault();
              resizeNavWithKeyboard(SIDEBAR_NAV_MIN_HEIGHT);
            }
            if (event.key === "End") {
              event.preventDefault();
              resizeNavWithKeyboard(SIDEBAR_NAV_MAX_HEIGHT);
            }
          }}
        />
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
            if (event.key === "ArrowLeft") {
              event.preventDefault();
              resizeWithKeyboard(sidebarWidth - 16);
            }
            if (event.key === "ArrowRight") {
              event.preventDefault();
              resizeWithKeyboard(sidebarWidth + 16);
            }
            if (event.key === "Home") {
              event.preventDefault();
              resizeWithKeyboard(SIDEBAR_MIN_WIDTH);
            }
            if (event.key === "End") {
              event.preventDefault();
              resizeWithKeyboard(SIDEBAR_MAX_WIDTH);
            }
          }}
        />
      </aside>
    </>
  );
}
