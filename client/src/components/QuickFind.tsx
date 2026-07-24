import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { search, SearchResult } from '../api';

interface QuickFindProps {
  open: boolean;
  onClose: () => void;
}

export default function QuickFind({ open, onClose }: QuickFindProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const navigate = useNavigate();

  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const res = await search(query);
      setResults(res);
      setSelectedIndex(0);
    }, 200);
    return () => clearTimeout(timerRef.current);
  }, [query]);

  const navigateTo = useCallback((result: SearchResult) => {
    onClose();
    if (result.type === 'row') {
      const rowId = result.id;
      navigate(`/page/${rowId}`);
    } else {
      navigate(`/page/${result.id}`);
    }
  }, [navigate, onClose]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      navigateTo(results[selectedIndex]);
    }
  };

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        justifyContent: 'center',
        paddingTop: '15vh',
        background: 'rgba(0,0,0,0.4)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 520,
          maxWidth: '90vw',
          background: 'var(--bg)',
          borderRadius: 8,
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
          maxHeight: '60vh',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={e => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search pages, databases, rows..."
          style={{
            width: '100%',
            padding: '14px 18px',
            fontSize: 16,
            border: 'none',
            borderBottom: '1px solid var(--border)',
            outline: 'none',
            background: 'transparent',
            color: 'var(--text)',
          }}
        />
        <div style={{ overflow: 'auto', flex: 1 }}>
          {results.length === 0 && query.trim() ? (
            <div style={{ padding: '24px 18px', color: 'var(--text-muted)', textAlign: 'center', fontSize: 14 }}>
              No results found
            </div>
          ) : (
            results.map((r, i) => (
              <div
                key={r.id}
                onClick={() => navigateTo(r)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 18px',
                  cursor: 'pointer',
                  background: i === selectedIndex ? 'var(--bg-hover)' : 'transparent',
                  transition: 'background var(--transition)',
                }}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                <span style={{ fontSize: 18, width: 24, textAlign: 'center', flexShrink: 0 }}>
                  {r.icon || (r.type === 'row' ? '📋' : '📄')}
                </span>
                <span style={{ flex: 1, fontSize: 14, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.title}
                </span>
                <span style={{
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  background: 'var(--bg-secondary)',
                  padding: '2px 6px',
                  borderRadius: 4,
                  textTransform: 'uppercase',
                  fontWeight: 500,
                }}>
                  {r.type}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}