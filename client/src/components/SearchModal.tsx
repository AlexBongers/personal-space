import { useState, useEffect, useRef, useCallback } from "react";
import * as api from "../api";
import type { SearchResult } from "../api";
import styles from "./SearchModal.module.css";

interface SearchModalProps {
  open: boolean;
  onClose: () => void;
  onNavigateToPage: (id: string) => void;
  onNavigateToRow: (rowId: string) => void;
}

export default function SearchModal({ open, onClose, onNavigateToPage, onNavigateToRow }: SearchModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setHighlightIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleGlobalKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleGlobalKey);
    return () => window.removeEventListener("keydown", handleGlobalKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setHighlightIndex(0);
      return;
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    setLoading(true);
    debounceRef.current = setTimeout(() => {
      api
        .search(query.trim())
        .then((data) => {
          setResults(data);
          setHighlightIndex(0);
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }, 200);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightIndex((prev) => Math.min(prev + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (results.length > 0 && results[highlightIndex]) {
          selectResult(results[highlightIndex]);
        }
      } else if (e.key === "Escape") {
        onClose();
      }
    },
    [results, highlightIndex, onClose]
  );

  const selectResult = useCallback(
    (result: SearchResult) => {
      if (result.type === "row") {
        onNavigateToRow(result.id);
      } else {
        onNavigateToPage(result.id);
      }
      onClose();
    },
    [onNavigateToPage, onNavigateToRow, onClose]
  );

  if (!open) return null;

  const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;

  return (
    <div className={styles.overlay} onClick={onClose} data-testid="search-overlay">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} data-testid="search-modal">
        <div className={styles.searchInputWrapper}>
          <span className={styles.searchIcon}>&#128269;</span>
          <input
            ref={inputRef}
            className={styles.searchInput}
            type="text"
            placeholder="Search pages, databases, and rows..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            data-testid="search-input"
          />
          <span className={styles.shortcutHint}>{isMac ? "⌘K" : "Ctrl+K"}</span>
        </div>
        <div className={styles.results}>
          {loading && results.length === 0 && (
            <div className={styles.noResults}>Searching...</div>
          )}
          {!loading && query.trim() && results.length === 0 && (
            <div className={styles.noResults}>No results found</div>
          )}
          {results.map((result, index) => (
            <div
              key={result.type + result.id}
              className={`${styles.resultItem} ${index === highlightIndex ? styles.highlighted : ""}`}
              onClick={() => selectResult(result)}
              data-testid="search-result"
            >
              <span className={styles.resultIcon}>{result.icon}</span>
              <div className={styles.resultBody}>
                <div className={styles.resultTitle}>{result.title}</div>
                {result.parentChain.length > 0 && (
                  <div className={styles.resultBreadcrumb}>
                    {result.parentChain.map((p, i) => (
                      <span key={p.id}>
                        {i > 0 && <span> / </span>}
                        {p.title}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <span className={styles.resultType}>{result.type}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
