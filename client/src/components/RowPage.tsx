import { useState, useEffect } from 'react';
import { fetchPage, fetchDatabase } from '../api';
import type { DatabaseProperty, DatabaseData } from '../api';
import PageEditor from './PageEditor';

interface RowPageProps {
  pageId: string;
}

const OPTION_COLORS: Record<string, string> = {
  gray: '#9ca3af',
  brown: '#a0785a',
  orange: '#d97706',
  yellow: '#eab308',
  green: '#22c55e',
  blue: '#3b82f6',
  purple: '#a855f7',
  pink: '#ec4899',
  red: '#ef4444',
};

export default function RowPage({ pageId }: RowPageProps) {
  const [page, setPage] = useState<any>(null);
  const [dbData, setDbData] = useState<DatabaseData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pg = await fetchPage(pageId);
        if (cancelled) return;
        setPage(pg);
        if (pg.parent_id) {
          const data = await fetchDatabase(pg.parent_id);
          if (!cancelled) setDbData(data);
        }
      } catch (e) {
        console.error('Failed to load row page:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [pageId]);

  if (loading) {
    return <div style={{ padding: 32, color: 'var(--text-secondary)' }}>Loading...</div>;
  }

  if (!page) {
    return <div style={{ padding: 32, color: 'var(--text-secondary)' }}>Page not found</div>;
  }

  const properties = dbData?.properties || [];
  const cells = (dbData?.cells || {})[pageId] || {};

  return (
    <div style={{ padding: '32px 48px', maxWidth: 800, margin: '0 auto' }}>
      <div style={{ marginBottom: 8 }}>
        <span style={{ fontSize: 28, fontWeight: 700 }}>{page.icon}</span>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: '8px 0', color: 'var(--text)' }}>
          {page.title}
        </h1>
      </div>

      {properties.length > 0 && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 0, marginBottom: 24, padding: '12px 0', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
            {properties.map(prop => (
              <PropertyDisplay key={prop.id} property={prop} value={cells[prop.id]} />
            ))}
          </div>
        </>
      )}

      <PageEditor pageId={pageId} />
    </div>
  );
}

function PropertyDisplay({ property, value }: { property: DatabaseProperty; value: any }) {
  return (
    <>
      <div style={{
        padding: '6px 12px 6px 0',
        fontSize: 13,
        fontWeight: 600,
        color: 'var(--text-secondary)',
        display: 'flex',
        alignItems: 'flex-start',
        lineHeight: 1.5,
      }}>
        {property.name}
      </div>
      <div style={{
        padding: '6px 0',
        fontSize: 14,
        color: 'var(--text)',
        minHeight: 28,
        display: 'flex',
        alignItems: 'flex-start',
        lineHeight: 1.5,
      }}>
        <PropertyValue property={property} value={value} />
      </div>
    </>
  );
}

function PropertyValue({ property, value }: { property: DatabaseProperty; value: any }) {
  switch (property.type) {
    case 'text':
      return <span>{value || ''}</span>;

    case 'number':
      return <span>{value !== null && value !== undefined ? Number(value).toLocaleString() : ''}</span>;

    case 'select': {
      if (!value) return <span style={{ color: 'var(--text-muted)' }}>--</span>;
      const opt = property.options.find(o => o.id === value);
      if (!opt) return <span>{value}</span>;
      return (
        <span style={{
          display: 'inline-block',
          padding: '1px 8px',
          borderRadius: 4,
          fontSize: 13,
          fontWeight: 500,
          backgroundColor: OPTION_COLORS[opt.color] || '#9ca3af',
          color: '#fff',
        }}>
          {opt.label}
        </span>
      );
    }

    case 'multi_select': {
      const selected = Array.isArray(value) ? value : [];
      if (selected.length === 0) return <span style={{ color: 'var(--text-muted)' }}>--</span>;
      return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {selected.map(id => {
            const opt = property.options.find(o => o.id === id);
            if (!opt) return null;
            return (
              <span key={id} style={{
                display: 'inline-block',
                padding: '1px 8px',
                borderRadius: 4,
                fontSize: 13,
                fontWeight: 500,
                backgroundColor: OPTION_COLORS[opt.color] || '#9ca3af',
                color: '#fff',
              }}>
                {opt.label}
              </span>
            );
          })}
        </div>
      );
    }

    case 'date': {
      if (!value) return <span style={{ color: 'var(--text-muted)' }}>--</span>;
      const d = new Date(value);
      return <span>{d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</span>;
    }

    case 'checkbox':
      return value ? (
        <span style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 16 }}>checkmark</span>
      ) : (
        <span style={{ color: 'var(--text-muted)', fontSize: 16 }}>x</span>
      );

    case 'url': {
      if (!value) return <span style={{ color: 'var(--text-muted)' }}>--</span>;
      return (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--accent)', textDecoration: 'underline' }}
        >
          {value}
        </a>
      );
    }

    default:
      return <span>{value || ''}</span>;
  }
}