import { useEffect, useRef, useState } from 'react';
import type { SearchResult } from '@shared';
import { api } from '../api.ts';
import { displayTitle } from '../db.ts';
import { Search } from './icons.tsx';

interface QuickFindProps {
  onPick: (id: string) => void;
  onClose: () => void;
}

const KIND_LABEL = { page: 'Page', database: 'Database', row: 'Entry' } as const;

/** Type-ahead over page, database and row titles. */
export function QuickFind({ onPick, onClose }: QuickFindProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    let stale = false;
    api
      .search(query)
      .then((next) => {
        if (stale) return;
        setResults(next);
        setActive(0);
      })
      .catch(() => !stale && setResults([]));
    return () => {
      stale = true;
    };
  }, [query]);

  const choose = (result: SearchResult | undefined) => {
    if (!result) return;
    onPick(result.id);
    onClose();
  };

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div
        className="finder"
        role="dialog"
        aria-modal="true"
        aria-label="Quick find"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="finder__field">
          <Search size={17} />
          <input
            ref={inputRef}
            className="finder__input"
            placeholder="Search pages, databases and entries…"
            aria-label="Search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
              if (e.key === 'Enter') choose(results[active]);
              if (e.key === 'ArrowDown' && results.length) {
                e.preventDefault();
                setActive((i) => (i + 1) % results.length);
              }
              if (e.key === 'ArrowUp' && results.length) {
                e.preventDefault();
                setActive((i) => (i - 1 + results.length) % results.length);
              }
            }}
          />
          <kbd className="kbd">Esc</kbd>
        </div>

        <div className="finder__results" data-testid="search-results">
          {query.trim() && results.length === 0 && (
            <p className="finder__empty">Nothing matches “{query.trim()}”.</p>
          )}
          {!query.trim() && <p className="finder__empty">Start typing to search your space.</p>}
          {results.map((result, index) => (
            <button
              key={result.id}
              className={`finder__hit${index === active ? ' finder__hit--active' : ''}`}
              data-testid={`search-hit-${result.title}`}
              onMouseEnter={() => setActive(index)}
              onClick={() => choose(result)}
            >
              {result.icon ? (
                <span className="finder__icon">{result.icon}</span>
              ) : (
                <span className={`finder__dot finder__dot--${result.kind}`} aria-hidden />
              )}
              <span className="finder__text">
                <span className="finder__title">{displayTitle(result.title)}</span>
                {result.parentTitle && <span className="finder__where">in {result.parentTitle}</span>}
              </span>
              <span className={`tag tag--${result.kind}`}>{KIND_LABEL[result.kind]}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
