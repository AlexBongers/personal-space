import { useState } from 'react';
import type { DatabaseProperty, DatabaseRow } from '../api';

interface BoardViewProps {
  properties: DatabaseProperty[];
  rows: DatabaseRow[];
  cells: { [rowId: string]: { [propId: string]: any } };
  groupBy: string | null;
  onGroupByChange: (propertyId: string | null) => void;
  onUpdateCell: (rowId: string, propertyId: string, value: any) => void;
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

export default function BoardView({ properties, rows, cells, groupBy, onGroupByChange, onUpdateCell }: BoardViewProps) {
  const [dragRowId, setDragRowId] = useState<string | null>(null);

  const selectProperties = properties.filter(p => p.type === 'select');
  const groupingProperty = properties.find(p => p.id === groupBy) || null;

  const handleDragStart = (rowId: string) => {
    setDragRowId(rowId);
  };

  const handleDrop = (targetOptionId: string) => {
    if (!dragRowId || !groupBy) return;
    onUpdateCell(dragRowId, groupBy, targetOptionId);
    setDragRowId(null);
  };

  if (selectProperties.length === 0) {
    return (
      <div style={{
        padding: 32,
        textAlign: 'center',
        color: 'var(--text-secondary)',
        background: 'var(--bg-secondary)',
        borderRadius: 8,
        border: '1px solid var(--border)',
      }}>
        Add a select property to use board view
      </div>
    );
  }

  const columns = groupingProperty
    ? groupingProperty.options.map(opt => {
        const columnRows = rows.filter(r => (cells[r.id] || {})[groupingProperty.id] === opt.id);
        return { option: opt, rows: columnRows };
      })
    : [{ option: null, rows }];

  const ungroupedRows = groupingProperty
    ? rows.filter(r => {
        const val = (cells[r.id] || {})[groupingProperty.id];
        return val === undefined || val === null || val === '';
      })
    : [];

  const allColumns = groupingProperty
    ? [...columns, ...(ungroupedRows.length > 0 ? [{ option: null, rows: ungroupedRows }] : [])]
    : columns;

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
          Group by:
        </label>
        <select
          value={groupBy || ''}
          onChange={e => onGroupByChange(e.target.value || null)}
          style={{
            padding: '4px 10px',
            borderRadius: 4,
            border: '1px solid var(--border)',
            background: 'var(--bg)',
            color: 'inherit',
            fontSize: 13,
          }}
        >
          <option value="">None</option>
          {selectProperties.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
        {allColumns.map((col, idx) => {
          const opt = col.option;
          const label = opt ? opt.label : 'No value';
          const color = opt ? (OPTION_COLORS[opt.color] || '#9ca3af') : 'var(--text-muted)';

          return (
            <div
              key={opt ? opt.id : 'no-value'}
              style={{
                minWidth: 240,
                maxWidth: 280,
                flex: '0 0 auto',
                borderRadius: 8,
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                maxHeight: 'calc(100vh - 280px)',
              }}
            >
              <div style={{
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                borderBottom: '1px solid var(--border)',
              }}>
                <span style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  backgroundColor: color,
                  flexShrink: 0,
                }} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
                <span style={{
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  background: 'var(--bg-hover)',
                  borderRadius: 8,
                  padding: '0 6px',
                  lineHeight: '18px',
                }}>
                  {col.rows.length}
                </span>
              </div>

              <div
                style={{
                  padding: 8,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  overflowY: 'auto',
                  flex: 1,
                  minHeight: 60,
                }}
                onDragOver={e => { e.preventDefault(); }}
                onDrop={e => {
                  e.preventDefault();
                  if (opt) handleDrop(opt.id);
                }}
              >
                {col.rows.map(row => (
                  <div
                    key={row.id}
                    draggable
                    onDragStart={() => handleDragStart(row.id)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 6,
                      background: 'var(--bg)',
                      border: '1px solid var(--border)',
                      cursor: 'grab',
                      fontSize: 14,
                      fontWeight: 500,
                      boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                      transition: 'box-shadow 0.15s',
                    }}
                    onMouseEnter={e => {
                      (e.target as HTMLElement).style.boxShadow = '0 2px 6px rgba(0,0,0,0.1)';
                    }}
                    onMouseLeave={e => {
                      (e.target as HTMLElement).style.boxShadow = '0 1px 2px rgba(0,0,0,0.04)';
                    }}
                  >
                    {row.title}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}