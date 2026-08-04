"use client";

import { useEffect, useRef, useState } from "react";
import { useLanguage } from "./i18n";
import type { SearchResult } from "./types";

type SearchDialogProps = {
  query: string;
  results: SearchResult[];
  onQueryChange: (query: string) => void;
  onChoose: (result: SearchResult) => void;
  onClose: () => void;
};

export function SearchDialog({ query, results, onQueryChange, onChoose, onClose }: SearchDialogProps) {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="search-overlay" role="dialog" aria-modal="true" aria-label={t("search.quickFind")} onClick={onClose}>
      <div className="search-dialog" onClick={(event) => event.stopPropagation()}>
        <div className="search-input-wrap">
          <span>⌕</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setActiveIndex(0);
              onQueryChange(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveIndex((index) => Math.min(index + 1, Math.max(results.length - 1, 0)));
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex((index) => Math.max(index - 1, 0));
              }
              if (event.key === "Enter" && results[activeIndex]) {
                event.preventDefault();
                onChoose(results[activeIndex]);
              }
            }}
            placeholder={t("search.placeholder")}
            aria-label={t("search.aria")}
            aria-controls="search-results"
          />
          <kbd>ESC</kbd>
        </div>
        {query ? (
          <div className="search-results" id="search-results">
            {results.map((result, index) => (
              <button
                className={index === activeIndex ? "active" : ""}
                key={`${result.id}-${result.rowId || "item"}`}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => onChoose(result)}
              >
                <span className="result-icon">
                  {result.kind === "row" ? "↗" : result.kind === "database" ? "▦" : "✦"}
                </span>
                <span><strong>{result.label}</strong><small>{result.kind === "row" ? t("search.resultRow", { database: result.context || t("search.resultDatabase") }) : result.kind === "database" ? t("search.resultDatabase") : t("search.resultPage")}</small></span>
                <span className="result-arrow">→</span>
              </button>
            ))}
            {results.length === 0 && <div className="no-results">{t("search.noResults", { query })}</div>}
          </div>
        ) : (
          <div className="search-empty">
            <span className="search-command">⌘K</span>
            <p>{t("search.emptyTitle")}</p>
            <small>{t("search.emptyHint")}</small>
          </div>
        )}
      </div>
    </div>
  );
}
