"use client";

import { lazy, Suspense, useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  createEmptyDatabase,
  createEmptyPage,
  createGoogleCalendarDatabase,
  descendantIds,
  GOOGLE_CALENDAR_DATABASE_ID,
  isDatabase,
  isPage,
  STORAGE_KEYS,
  uid,
  GOOGLE_TASKS_DATABASE_ID,
  GOOGLE_TASK_PROPERTY_IDS,
} from "./personal-space/model";
import { Sidebar } from "./personal-space/Sidebar";
import { InterfaceIcon } from "./personal-space/InterfaceIcon";
import { GmailInbox } from "./personal-space/GmailInbox";
import { ParroInbox } from "./personal-space/ParroInbox";
import { SlashdotFeed } from "./personal-space/SlashdotFeed";
import type { Block, Item, SearchResult, Theme } from "./personal-space/types";
import { useLanguage } from "./personal-space/i18n";
import { useWorkspacePersistence } from "./personal-space/useWorkspacePersistence";

const BlockEditor = lazy(() => import("./personal-space/BlockEditor").then((module) => ({ default: module.BlockEditor })));
const DatabaseView = lazy(() => import("./personal-space/DatabaseView").then((module) => ({ default: module.DatabaseView })));
const HomeOverview = lazy(() => import("./personal-space/HomeOverview").then((module) => ({ default: module.HomeOverview })));
const SearchDialog = lazy(() => import("./personal-space/SearchDialog").then((module) => ({ default: module.SearchDialog })));
const GoogleTasksDialog = lazy(() => import("./personal-space/GoogleTasksDialog").then((module) => ({ default: module.GoogleTasksDialog })));
const GoogleCalendarDialog = lazy(() => import("./personal-space/GoogleCalendarDialog").then((module) => ({ default: module.GoogleCalendarDialog })));

const isTypingTarget = (target: EventTarget | null) => {
  const element = target as HTMLElement | null;
  return element?.matches("input, textarea, select, [contenteditable='true']") ?? false;
};

export default function Home() {
  const {
    items,
    setItems,
    replaceItems,
    revision,
    hydrated,
    editingReady,
    mutationLocked,
    syncState,
    conflicts,
    retry,
    beginExternalMutation,
    legacyRecovery,
    recoveryRecords,
    recoveryDraftId,
    acceptLegacyRecovery,
    dismissLegacyRecovery,
    recoverDraft,
    discardRecovery,
  } = useWorkspacePersistence();
  const { language, setLanguage, t } = useLanguage();
  const [selectedId, setSelectedId] = useState("home");
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [theme, setTheme] = useState<Theme>("light");
  const [themeReady, setThemeReady] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [googleTasksOpen, setGoogleTasksOpen] = useState(false);
  const [googleCalendarOpen, setGoogleCalendarOpen] = useState(false);
  const [gmailAuthorizationError, setGmailAuthorizationError] = useState(false);
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    if (!hydrated || !editingReady || items.some((item) => item.id === GOOGLE_CALENDAR_DATABASE_ID)) return;
    setItems((current) => current.some((item) => item.id === GOOGLE_CALENDAR_DATABASE_ID)
      ? current
      : [...current, createGoogleCalendarDatabase()]);
  }, [hydrated, editingReady, items, setItems]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const storedTheme = window.localStorage.getItem(STORAGE_KEYS.theme) as Theme | null;
        if (storedTheme === "dark" || storedTheme === "light") setTheme(storedTheme);
      } catch {
        // Keep the light theme if browser preferences are unavailable.
      }
      setThemeReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      if (params.get("google") === "connected" || params.get("google") === "error") {
        if (params.get("service") === "gmail") {
          setSelectedId("gmail");
          setGmailAuthorizationError(params.get("google") === "error");
        } else if (params.get("service") === "calendar") setGoogleCalendarOpen(true);
        else setGoogleTasksOpen(true);
        window.history.replaceState({}, "", window.location.pathname);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!themeReady) return;
    document.documentElement.style.colorScheme = theme;
    try {
      window.localStorage.setItem(STORAGE_KEYS.theme, theme);
    } catch {
      // Theme switching also works when browser storage is unavailable.
    }
  }, [theme, themeReady]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === "Escape") {
        setSearchOpen(false);
        setSidebarOpen(false);
        setGoogleTasksOpen(false);
        setGoogleCalendarOpen(false);
      }
      if (!event.metaKey && !event.ctrlKey && event.key.toLowerCase() === "h" && !isTypingTarget(event.target)) {
        setSelectedId("home");
        setSelectedRowId(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const selected = items.find((item) => item.id === selectedId) || items[0];
  const utilityPage = selectedId === "gmail" || selectedId === "parro" || selectedId === "news-slashdot" || selectedId === "news-tweakers" || selectedId === "news-nos" || selectedId === "news-bunniksnieuws" ? selectedId : null;
  const currentTitle = utilityPage === "gmail" ? t("gmail.title") : utilityPage === "parro" ? t("parro.title") : utilityPage === "news-slashdot" ? "Slashdot" : utilityPage === "news-tweakers" ? "Tweakers" : utilityPage === "news-nos" ? "NOS" : utilityPage === "news-bunniksnieuws" ? "Bunniks Nieuws" : selected?.title || t("nav.home");

  const updateItem = (next: Item) => {
    setItems((current) => current.map((item) => item.id === next.id ? next : item));
  };

  const selectItem = (id: string, rowId?: string) => {
    setSelectedId(id);
    setSelectedRowId(rowId || null);
    setSearchOpen(false);
    setSidebarOpen(false);
    setQuery("");
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  };

  const createPage = (parentId: string | null) => {
    const page = createEmptyPage(parentId);
    setItems((current) => [...current, page]);
    if (parentId) setExpanded((current) => new Set(current).add(parentId));
    selectItem(page.id);
  };

  const createDatabase = () => {
    const database = createEmptyDatabase();
    setItems((current) => [...current, database]);
    selectItem(database.id);
  };

  const renameItem = (id: string, title: string) => {
    setItems((current) => current.map((item) => item.id === id ? { ...item, title } : item));
  };

  const changeIcon = (id: string) => {
    const item = items.find((entry) => entry.id === id);
    if (!item) return;
    const icon = window.prompt(t("dialogs.chooseIcon"), item.icon);
    if (icon?.trim()) {
      setItems((current) => current.map((entry) => entry.id === id ? { ...entry, icon: icon.trim().slice(0, 3) } : entry));
    }
  };

  const deleteItem = (id: string) => {
    const target = items.find((item) => item.id === id);
    if (!target || id === "home" || !window.confirm(t("dialogs.deleteItem", { title: target.title }))) return;
    const idsToDelete = descendantIds(items, id);
    setItems((current) => current.filter((item) => !idsToDelete.has(item.id)));
    selectItem("home");
  };

  const quickAdd = (kind: "task" | "note", text: string): boolean => {
    if (!editingReady || syncState === "loading" || syncState === "conflict") return false;
    if (kind === "note") {
      const page = { ...createEmptyPage(null), title: text };
      const accepted = setItems((current) => [...current, page]);
      if (accepted) selectItem(page.id);
      return accepted;
    }
    const database = items.find((item) => item.id === GOOGLE_TASKS_DATABASE_ID);
    if (!database || !isDatabase(database)) return false;
    const row = {
      id: uid("task"),
      title: text,
      values: {
        [GOOGLE_TASK_PROPERTY_IDS.status]: "Open",
        [GOOGLE_TASK_PROPERTY_IDS.due]: null,
        [GOOGLE_TASK_PROPERTY_IDS.notes]: "",
        [GOOGLE_TASK_PROPERTY_IDS.list]: "",
        [GOOGLE_TASK_PROPERTY_IDS.link]: "",
        [GOOGLE_TASK_PROPERTY_IDS.id]: "",
        [GOOGLE_TASK_PROPERTY_IDS.parent]: "",
        [GOOGLE_TASK_PROPERTY_IDS.position]: "",
      },
      blocks: [],
    };
    return setItems((current) => current.map((item) => item.id === database.id && isDatabase(item) ? { ...item, rows: [...item.rows, row] } : item));
  };

  const syncLabel = mutationLocked
    ? (language === "nl" ? "Google-sync bezig" : "Google sync in progress")
    : syncState === "conflict"
    ? (language === "nl" ? "Conflict: controleer wijzigingen" : "Conflict: review changes")
    : t(`sync.${syncState}`);
  const persistenceBlocked = !editingReady || syncState === "loading" || syncState === "conflict";

  const searchResults = useMemo<SearchResult[]>(() => {
    const needle = deferredQuery.toLowerCase().trim();
    if (!needle) return [];
    return items.flatMap((item) => {
      const results: SearchResult[] = [];
      if (item.title.toLowerCase().includes(needle)) {
        results.push({
          id: item.id,
          label: item.title,
          kind: item.kind === "database" ? "database" : "page",
          parentId: item.parentId,
        });
      }
      if (item.kind === "database") {
        item.rows.forEach((row) => {
          if (row.title.toLowerCase().includes(needle)) {
            results.push({
              id: item.id,
              label: row.title,
              kind: "row",
              parentId: item.parentId,
              context: item.title,
              rowId: row.id,
            });
          }
        });
      }
      return results;
    });
  }, [deferredQuery, items]);

  const updateSelectedBlocks = (blocks: Block[]) => {
    if (isPage(selected)) updateItem({ ...selected, blocks });
  };

  const toggleExpanded = (id: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <main className={`app-shell theme-${theme}`}>
      <Sidebar
        items={items}
        selectedId={selectedId}
        expanded={expanded}
        mobileOpen={sidebarOpen}
        onDismiss={() => setSidebarOpen(false)}
        onSelect={(id) => id === "search" ? setSearchOpen(true) : selectItem(id)}
        onToggle={toggleExpanded}
        onCreatePage={createPage}
        onCreateDatabase={createDatabase}
        onRename={renameItem}
        onDelete={deleteItem}
      />
      <section className="main-area">
        <header className="topbar">
          <div className="topbar-leading">
            <button className="mobile-menu" aria-label={t("nav.openNavigation")} onClick={() => setSidebarOpen(true)}><InterfaceIcon name="menu" /></button>
            {!utilityPage && selected?.id === "home" && <span className="compact-greeting">{t("overview.greeting")}</span>}
            {(utilityPage || selected?.id !== "home") && <div className="breadcrumbs"><span>{t("top.workspace")}</span><span>›</span><strong>{currentTitle}</strong></div>}
          </div>
          <div className="topbar-actions">
            <button className="search-trigger" aria-label={t("top.search")} onClick={() => setSearchOpen(true)}>
              <span><InterfaceIcon name="search" /></span><span>{t("top.search")}</span><kbd>⌘ K</kbd>
            </button>
            <button className="tasks-trigger" aria-label={t("google.open")} onClick={() => setGoogleTasksOpen(true)}>
              <span><InterfaceIcon name="tasks" /></span><span>{t("top.googleTasks")}</span>
            </button>
            <button className="tasks-trigger calendar-trigger" aria-label={t("calendar.title")} onClick={() => setGoogleCalendarOpen(true)}>
              <span><InterfaceIcon name="calendar" /></span><span>{t("top.googleCalendar")}</span>
            </button>
            <div className="language-switch" role="group" aria-label={t("language.label")}>
              <button type="button" className={language === "en" ? "active" : ""} aria-label={t("language.switchToEnglish")} aria-pressed={language === "en"} onClick={() => setLanguage("en")}>EN</button>
              <button type="button" className={language === "nl" ? "active" : ""} aria-label={t("language.switchToDutch")} aria-pressed={language === "nl"} onClick={() => setLanguage("nl")}>NL</button>
            </div>
            <div className="theme-switch" role="group" aria-label={t("top.theme")}>
              <button type="button" className={theme === "light" ? "active" : ""} onClick={() => setTheme("light")} aria-label={t("top.switchToLight")} aria-pressed={theme === "light"}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></svg>
              </button>
              <button type="button" className={theme === "dark" ? "active" : ""} onClick={() => setTheme("dark")} aria-label={t("top.switchToDark")} aria-pressed={theme === "dark"}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 14A9 9 0 0 1 10 3.5 9 9 0 1 0 20.5 14Z" /></svg>
              </button>
            </div>
            <span className={`sync-indicator sync-${syncState}`} role="status" aria-label={syncLabel} title={syncLabel}>
              <i aria-hidden="true" />
            </span>
            <span className="sync-label">{syncLabel}</span>
          </div>
        </header>
        <div className="content-scroll">
          <Suspense fallback={<div className="view-loading" aria-hidden="true"><span /><span /><span /></div>}>
            {utilityPage ? <div className="page-view utility-page">{utilityPage === "gmail" ? <GmailInbox authorizationError={gmailAuthorizationError} /> : utilityPage === "parro" ? <ParroInbox /> : <SlashdotFeed key={utilityPage} source={utilityPage === "news-slashdot" ? "slashdot" : utilityPage === "news-tweakers" ? "tweakers" : utilityPage === "news-nos" ? "nos" : "bunniksnieuws"} />}</div> : isDatabase(selected) ? (
              <DatabaseView
                key={`${selected.id}-${selectedRowId || "none"}`}
                database={selected}
                onUpdate={updateItem}
                initialRowId={selectedRowId}
              />
            ) : selected?.id === "home" ? (
              <div className="page-view home-page">
                <HomeOverview
                  items={items}
                  onOpen={selectItem}
                  onQuickAdd={quickAdd}
                  quickAddDisabled={persistenceBlocked}
                  quickAddStatus={conflicts.length ? syncLabel : undefined}
                />
              </div>
            ) : (
              <div className="page-view">
                <div className="page-heading">
                  <button className="page-icon" aria-label={t("top.changeIcon")} onClick={() => selected && changeIcon(selected.id)}>
                    {selected?.icon || "⌂"}
                  </button>
                  <input
                    className="page-title-input"
                    value={selected?.title || ""}
                    onChange={(event) => selected && renameItem(selected.id, event.target.value)}
                    aria-label={t("top.pageTitle")}
                  />
                  {selected?.id !== "home" && <button className="page-menu" aria-label={t("top.deletePage")} onClick={() => selected && deleteItem(selected.id)}>•••</button>}
                </div>
                {selected && isPage(selected) && <BlockEditor item={selected} onChange={updateSelectedBlocks} />}
              </div>
            )}
          </Suspense>
        </div>
        {syncState === "conflict" && (
          <div className="workspace-alert" role="alert">
            <span>{syncLabel}{conflicts.length ? ` (${conflicts.length})` : ""}</span>
            <button type="button" className="small-button" onClick={() => void retry()}>{language === "nl" ? "Opnieuw proberen" : "Retry"}</button>
          </div>
        )}
        {legacyRecovery && (
          <div className="workspace-alert" role="region" aria-label={language === "nl" ? "Legacy-workspace gevonden" : "Legacy workspace found"}>
            <span>{language === "nl" ? "Er is een oudere browserworkspace gevonden. Kies expliciet of je die wilt importeren." : "An older browser workspace was found. Choose explicitly whether to import it."}</span>
            <span>
              <button type="button" className="small-button" disabled={!editingReady || syncState === "saving"} onClick={() => { acceptLegacyRecovery(); }}>{language === "nl" ? "Importeren" : "Import"}</button>
              <button type="button" className="small-button" disabled={syncState === "saving"} onClick={dismissLegacyRecovery}>{language === "nl" ? "D1 behouden" : "Keep D1"}</button>
            </span>
          </div>
        )}
        {recoveryRecords.some((record) => record.draftId !== recoveryDraftId) && (
          <details className="workspace-recovery-list">
            <summary>{language === "nl" ? "Herstelkopieën uit andere tabs" : "Recovery drafts from other tabs"}</summary>
            {recoveryRecords.filter((record) => record.draftId !== recoveryDraftId).map((record) => (
              <div className="workspace-recovery-row" key={record.draftId}>
                <span><strong>{record.draftId.slice(0, 12)}</strong><small>{record.draftItems.slice(0, 3).map((item) => item.title).join(", ")}</small></span>
                <span>
                  <button type="button" className="small-button" disabled={!editingReady} onClick={() => { recoverDraft(record.draftId); }}>{language === "nl" ? "Herstellen" : "Recover"}</button>
                  <button type="button" className="small-button" onClick={() => { discardRecovery(record.draftId); }}>{language === "nl" ? "Verwijderen" : "Discard"}</button>
                </span>
              </div>
            ))}
          </details>
        )}
      </section>
      {searchOpen && (
        <Suspense fallback={null}><SearchDialog
            query={query}
            results={searchResults}
            onQueryChange={setQuery}
            onChoose={(result) => selectItem(result.id, result.rowId)}
            onClose={() => setSearchOpen(false)}
          /></Suspense>
      )}
      {googleTasksOpen && (
          <Suspense fallback={null}><GoogleTasksDialog
            revision={revision}
            onReplace={replaceItems}
            onBeginSync={beginExternalMutation}
            onOpenDatabase={() => { setGoogleTasksOpen(false); selectItem("google-tasks"); }}
            onClose={() => setGoogleTasksOpen(false)}
          /></Suspense>
      )}
      {googleCalendarOpen && (
          <Suspense fallback={null}><GoogleCalendarDialog
            revision={revision}
            onReplace={replaceItems}
            onBeginSync={beginExternalMutation}
            onOpenDatabase={() => { setGoogleCalendarOpen(false); selectItem(GOOGLE_CALENDAR_DATABASE_ID); }}
            onClose={() => setGoogleCalendarOpen(false)}
          /></Suspense>
      )}
    </main>
  );
}
