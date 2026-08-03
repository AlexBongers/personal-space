"use client";

import { useEffect, useRef, useState } from "react";
import type { SearchResult } from "./types";

type SearchDialogProps = {
  query: string;
  results: SearchResult[];
  onQueryChange: (query: string) => void;
  onChoose: (result: SearchResult) => void;
  onClose: () => void;
};

export function SearchDialog({ query, results, onQueryChange, onChoose, onClose }: SearchDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="search-overlay" role="dialog" aria-modal="true" aria-label="Quick find" onClick={onClose}>
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
            placeholder="Search pages, databases and rows…"
            aria-label="Search pages, databases and rows"
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
                  {result.kind.startsWith("Row") ? "↗" : result.kind === "Database" ? "▦" : "✦"}
                </span>
                <span><strong>{result.label}</strong><small>{result.kind}</small></span>
                <span className="result-arrow">→</span>
              </button>
            ))}
            {results.length === 0 && <div className="no-results">No pages or rows found for “{query}”.</div>}
          </div>
        ) : (
          <div className="search-empty">
            <span className="search-command">⌘K</span>
            <p>Find anything in your workspace</p>
            <small>Search titles as you type. Use ↑↓ and Enter to jump.</small>
          </div>
        )}
      </div>
    </div>
  );
}
