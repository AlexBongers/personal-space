import type { DatabaseProperty, DatabaseRow } from '../api';
import PropertyEditor from './PropertyEditor';

interface TableViewProps {
  properties: DatabaseProperty[];
  rows: DatabaseRow[];
  cells: { [rowId: string]: { [propId: string]: any } };
  onUpdateCell: (rowId: string, propertyId: string, value: any) => void;
  onDeleteRow: (rowId: string) => void;
  onAddRow: () => void;
  onRenameRow: (rowId: string, title: string) => void;
}

const TYPE_LABELS: Record<string, string> = {
  text: 'T',
  number: '#',
  select: 'S',
  multi_select: 'M',
  date: 'D',
  checkbox: 'C',
  url: 'U',
};

export default function TableView({ properties, rows, cells, onUpdateCell, onDeleteRow, onAddRow, onRenameRow }: TableViewProps) {
  const rowTitleHeader = 'Title';

  return (
    <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--border)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border)' }}>
            <th style={headerCellStyle}>
              {rowTitleHeader}
            </th>
            {properties.map(prop => (
              <th key={prop.id} style={headerCellStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--text-muted)',
                    background: 'var(--bg-hover)',
                    borderRadius: 3,
                    padding: '0 4px',
                    lineHeight: '18px',
                  }}>
                    {TYPE_LABELS[prop.type] || '?'}
                  </span>
                  <span>{prop.name}</span>
                </div>
              </th>
            ))}
            <th style={{ ...headerCellStyle, width: 40 }}></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr
              key={row.id}
              style={{
                background: idx % 2 === 0 ? 'var(--bg)' : 'var(--bg-secondary)',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <td style={cellStyle}>
                <RowTitleEditor
                  title={row.title}
                  onSave={(title) => onRenameRow(row.id, title)}
                />
              </td>
              {properties.map(prop => (
                <td key={prop.id} style={cellStyle}>
                  <PropertyEditor
                    property={prop}
                    value={(cells[row.id] || {})[prop.id]}
                    onChange={(value) => onUpdateCell(row.id, prop.id, value)}
                  />
                </td>
              ))}
              <td style={{ ...cellStyle, width: 40, textAlign: 'center' }}>
                <button
                  onClick={() => onDeleteRow(row.id)}
                  title="Delete row"
                  style={{
                    color: 'var(--text-muted)',
                    fontSize: 16,
                    lineHeight: 1,
                    padding: '2px 6px',
                    borderRadius: 4,
                    cursor: 'pointer',
                    border: 'none',
                    background: 'transparent',
                  }}
                  onMouseEnter={e => { (e.target as HTMLElement).style.color = 'var(--text)'; }}
                  onMouseLeave={e => { (e.target as HTMLElement).style.color = 'var(--text-muted)'; }}
                >
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)' }}>
        <button
          onClick={onAddRow}
          style={{
            color: 'var(--text-secondary)',
            fontSize: 14,
            padding: '4px 12px',
            borderRadius: 6,
            cursor: 'pointer',
            border: 'none',
            background: 'transparent',
          }}
          onMouseEnter={e => { (e.target as HTMLElement).style.background = 'var(--bg-hover)'; }}
          onMouseLeave={e => { (e.target as HTMLElement).style.background = 'transparent'; }}
        >
          + New
        </button>
      </div>
    </div>
  );
}

function RowTitleEditor({ title, onSave }: { title: string; onSave: (title: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(title);
  }, [title]);

  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus();
      ref.current.select();
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    if (value.trim() && value !== title) {
      onSave(value.trim());
    } else {
      setValue(title);
    }
  };

  if (editing) {
    return (
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') { commit(); } if (e.key === 'Escape') { setValue(title); setEditing(false); } }}
        style={{
          width: '100%',
          border: 'none',
          outline: 'none',
          background: 'transparent',
          padding: '4px 8px',
          fontSize: 14,
          color: 'inherit',
          fontFamily: 'inherit',
        }}
      />
    );
  }

  return (
    <div
      onClick={() => setEditing(true)}
      style={{
        padding: '4px 8px',
        cursor: 'pointer',
        fontWeight: 500,
        minHeight: 32,
        display: 'flex',
        alignItems: 'center',
      }}
    >
      {title}
    </div>
  );
}

import { useState, useRef, useEffect } from 'react';

const headerCellStyle: React.CSSProperties = {
  padding: '8px 12px',
  textAlign: 'left',
  fontWeight: 600,
  fontSize: 13,
  color: 'var(--text-secondary)',
  whiteSpace: 'nowrap',
  userSelect: 'none',
};

const cellStyle: React.CSSProperties = {
  padding: 0,
  borderRight: '1px solid var(--border)',
  verticalAlign: 'top',
};