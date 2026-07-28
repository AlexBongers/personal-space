import { useState, useEffect, useCallback } from "react";
import { Page } from "shared/types";
import * as api from "./api";
import Sidebar from "./pages/Sidebar";
import PageView from "./pages/PageView";
import SearchModal from "./components/SearchModal";
import { useTheme } from "./context/ThemeContext";
import styles from "./App.module.css";

export default function App() {
  const [pages, setPages] = useState<Page[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const fetchPages = useCallback(async () => {
    try {
      const data = await api.getPages();
      setPages(data);
    } catch (err) {
      console.error("Failed to fetch pages:", err);
    }
  }, []);

  useEffect(() => {
    fetchPages();
  }, [fetchPages]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleNavigateToRow = useCallback(
    async (rowId: string) => {
      try {
        const row = await api.getRowByRowId(rowId);
        if (row.pageId) {
          setSelectedId(row.pageId);
        }
      } catch (err) {
        console.error("Failed to navigate to row:", err);
      }
    },
    []
  );

  const selectedPage = pages.find((p) => p.id === selectedId) || null;

  return (
    <div className={styles.layout}>
      <Sidebar
        pages={pages}
        selectedId={selectedId}
        onSelectPage={setSelectedId}
        onPagesChanged={fetchPages}
      />
      <div className={styles.content}>
        <div className={styles.topBar}>
          <button
            className={styles.searchBtn}
            onClick={() => setSearchOpen(true)}
            data-testid="search-btn"
            aria-label="Search"
          >
            <span className={styles.searchBtnIcon}>&#128269;</span>
            <span className={styles.searchBtnLabel}>Search</span>
            <span className={styles.searchBtnShortcut}>
              {navigator.platform.toUpperCase().indexOf("MAC") >= 0 ? "⌘K" : "Ctrl+K"}
            </span>
          </button>
          <button
            className={styles.themeBtn}
            onClick={toggleTheme}
            data-testid="theme-toggle"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
        </div>
        <PageView page={selectedPage} />
      </div>
      <SearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onNavigateToPage={setSelectedId}
        onNavigateToRow={handleNavigateToRow}
      />
    </div>
  );
}
