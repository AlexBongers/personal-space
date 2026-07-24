import { useNavigate } from 'react-router-dom';
import type { DatabaseProperty, DatabaseRow } from '../api';

interface ListViewProps {
  properties: DatabaseProperty[];
  rows: DatabaseRow[];
  cells: { [rowId: string]: { [propId: string]: any } };
}

export default function ListView({ properties, rows, cells }: ListViewProps) {
  const navigate = useNavigate();

  if (rows.length === 0) {
    return (
      <div style={{
        padding: 32,
        textAlign: 'center',
        color: 'var(--text-secondary)',
        background: 'var(--bg-secondary)',
        borderRadius: 8,
        border: '1px solid var(--border)',
      }}>
        No rows yet
      </div>
    );
  }

  return (
    <div style={{ borderRadius: 8, border: '1px solid var(--border)', overflow: 'hidden' }}>
      {rows.map((row, idx) => {
        const rowCells = cells[row.id] || {};
        const firstProp = properties[0];
        const firstPropValue = firstProp ? rowCells[firstProp.id] : null;

        return (
          <div
            key={row.id}
            onClick={() => navigate(`/page/${row.id}`)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 16px',
              cursor: 'pointer',
              background: idx % 2 === 0 ? 'var(--bg)' : 'var(--bg-secondary)',
              borderBottom: idx < rows.length - 1 ? '1px solid var(--border)' : 'none',
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => { (e.target as HTMLElement).style.background = 'var(--bg-hover)'; }}
            onMouseLeave={e => {
              (e.target as HTMLElement).style.background = idx % 2 === 0 ? 'var(--bg)' : 'var(--bg-secondary)';
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>
              {row.title}
            </span>
            {firstPropValue !== undefined && firstPropValue !== null && firstPropValue !== '' && (
              <span style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {formatValue(firstProp, firstPropValue)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function formatValue(prop: DatabaseProperty, value: any): string {
  if (prop.type === 'select') {
    const opt = prop.options.find(o => o.id === value);
    return opt ? opt.label : String(value);
  }
  if (prop.type === 'checkbox') {
    return value ? 'Yes' : 'No';
  }
  return String(value);
}