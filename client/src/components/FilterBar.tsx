import { useState, useCallback } from 'react';
import type { DatabaseProperty, Filter } from '../api';

interface FilterBarProps {
  properties: DatabaseProperty[];
  filters: Filter[];
  onChange: (filters: Filter[]) => void;
}

const OPERATORS: Record<string, { value: string; label: string }[]> = {
  text: [{ value: 'contains', label: 'Contains' }],
  select: [
    { value: 'is', label: 'Is' },
    { value: 'is not', label: 'Is not' },
  ],
  multi_select: [
    { value: 'contains', label: 'Contains' },
    { value: 'does not contain', label: 'Does not contain' },
  ],
  checkbox: [
    { value: 'is checked', label: 'Is checked' },
    { value: 'is not checked', label: 'Is not checked' },
  ],
  date: [
    { value: 'before', label: 'Before' },
    { value: 'after', label: 'After' },
  ],
  number: [
    { value: 'equals', label: 'Equals' },
    { value: 'greater than', label: 'Greater than' },
    { value: 'less than', label: 'Less than' },
  ],
  url: [{ value: 'contains', label: 'Contains' }],
};

export default function FilterBar({ properties, filters, onChange }: FilterBarProps) {
  const handleChange = useCallback((index: number, updates: Partial<Filter>) => {
    const newFilters = filters.map((f, i) => i === index ? { ...f, ...updates } : f);
    onChange(newFilters);
  }, [filters, onChange]);

  const handleRemove = useCallback((index: number) => {
    onChange(filters.filter((_, i) => i !== index));
  }, [filters, onChange]);

  const handleAdd = useCallback(() => {
    const firstProp = properties[0];
    if (!firstProp) return;
    const ops = OPERATORS[firstProp.type] || [];
    const newFilter: Filter = {
      propertyId: firstProp.id,
      operator: ops[0]?.value || 'contains',
      value: '',
    };
    onChange([...filters, newFilter]);
  }, [properties, filters, onChange]);

  if (properties.length === 0) return null;

  return (
    <div style={{ marginBottom: 12 }}>
      {filters.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
          {filters.map((filter, index) => {
            const prop = properties.find(p => p.id === filter.propertyId);
            const ops = prop ? OPERATORS[prop.type] || [] : [];

            return (
              <div
                key={index}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 10px',
                  background: 'var(--bg-secondary)',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                }}
              >
                <select
                  value={filter.propertyId}
                  onChange={e => {
                    const newProp = properties.find(p => p.id === e.target.value);
                    const newOps = newProp ? OPERATORS[newProp.type] || [] : [];
                    handleChange(index, {
                      propertyId: e.target.value,
                      operator: newOps[0]?.value || 'contains',
                      value: '',
                    });
                  }}
                  style={selectStyle}
                >
                  {properties.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>

                <select
                  value={filter.operator}
                  onChange={e => handleChange(index, { operator: e.target.value })}
                  style={selectStyle}
                >
                  {ops.map(op => (
                    <option key={op.value} value={op.value}>{op.label}</option>
                  ))}
                </select>

                <FilterValueInput
                  property={prop}
                  operator={filter.operator}
                  value={filter.value}
                  onChange={value => handleChange(index, { value })}
                />

                <button
                  onClick={() => handleRemove(index)}
                  style={{
                    color: 'var(--text-muted)',
                    fontSize: 16,
                    lineHeight: 1,
                    padding: '2px 6px',
                    borderRadius: 4,
                    cursor: 'pointer',
                    border: 'none',
                    background: 'transparent',
                    flexShrink: 0,
                  }}
                  title="Remove filter"
                >
                  x
                </button>
              </div>
            );
          })}
        </div>
      )}

      <button
        onClick={handleAdd}
        style={{
          color: 'var(--text-secondary)',
          fontSize: 13,
          padding: '4px 10px',
          borderRadius: 4,
          cursor: 'pointer',
          border: '1px dashed var(--border)',
          background: 'transparent',
        }}
      >
        + Add filter
      </button>
    </div>
  );
}

function FilterValueInput({
  property,
  operator,
  value,
  onChange,
}: {
  property?: DatabaseProperty;
  operator: string;
  value: any;
  onChange: (value: any) => void;
}) {
  if (!property) return null;

  if (property.type === 'checkbox') {
    return <span style={{ fontSize: 13, color: 'var(--text-muted)', minWidth: 80 }}>—</span>;
  }

  if (property.type === 'select') {
    return (
      <select
        value={value || ''}
        onChange={e => onChange(e.target.value || '')}
        style={selectStyle}
      >
        <option value="">--</option>
        {property.options.map(opt => (
          <option key={opt.id} value={opt.id}>{opt.label}</option>
        ))}
      </select>
    );
  }

  if (property.type === 'multi_select') {
    return (
      <select
        value={value || ''}
        onChange={e => onChange(e.target.value || '')}
        style={selectStyle}
      >
        <option value="">--</option>
        {property.options.map(opt => (
          <option key={opt.id} value={opt.id}>{opt.label}</option>
        ))}
      </select>
    );
  }

  if (property.type === 'date') {
    return (
      <input
        type="date"
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        style={inputStyle}
      />
    );
  }

  if (property.type === 'number') {
    return (
      <input
        type="number"
        value={value !== null && value !== undefined ? value : ''}
        onChange={e => {
          const v = e.target.value;
          onChange(v === '' ? '' : Number(v));
        }}
        style={inputStyle}
      />
    );
  }

  return (
    <input
      type="text"
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      placeholder="Value..."
      style={inputStyle}
    />
  );
}

const selectStyle: React.CSSProperties = {
  padding: '4px 8px',
  borderRadius: 4,
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  color: 'inherit',
  fontSize: 13,
  minWidth: 120,
};

const inputStyle: React.CSSProperties = {
  padding: '4px 8px',
  borderRadius: 4,
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  color: 'inherit',
  fontSize: 13,
  minWidth: 120,
  outline: 'none',
};