import type { DatabaseProperty, Sort } from '../api';

interface SortControlProps {
  properties: DatabaseProperty[];
  sort: Sort | null;
  onChange: (sort: Sort | null) => void;
}

export default function SortControl({ properties, sort, onChange }: SortControlProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Sort:</span>
      <select
        value={sort?.propertyId || ''}
        onChange={e => {
          if (!e.target.value) {
            onChange(null);
          } else {
            onChange({ propertyId: e.target.value, direction: sort?.direction || 'asc' });
          }
        }}
        style={{
          padding: '4px 10px',
          borderRadius: 4,
          border: '1px solid var(--border)',
          background: 'var(--bg)',
          color: 'inherit',
          fontSize: 13,
          minWidth: 140,
        }}
      >
        <option value="">No sort</option>
        {properties.map(p => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>

      {sort && (
        <button
          onClick={() => {
            onChange({
              propertyId: sort.propertyId,
              direction: sort.direction === 'asc' ? 'desc' : 'asc',
            });
          }}
          style={{
            padding: '4px 10px',
            borderRadius: 4,
            border: '1px solid var(--border)',
            background: 'var(--bg-hover)',
            color: 'inherit',
            fontSize: 13,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
          title={sort.direction === 'asc' ? 'Ascending' : 'Descending'}
        >
          {sort.direction === 'asc' ? 'Asc' : 'Desc'}
        </button>
      )}
    </div>
  );
}