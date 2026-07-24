import { useState, useRef, useEffect, useCallback } from 'react';
import type { DatabaseProperty } from '../api';

interface PropertyEditorProps {
  property: DatabaseProperty;
  value: any;
  onChange: (value: any) => void;
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

export default function PropertyEditor({ property, value, onChange }: PropertyEditorProps) {
  switch (property.type) {
    case 'text':
      return <TextEditor value={value || ''} onChange={onChange} />;
    case 'number':
      return <NumberEditor value={value} onChange={onChange} />;
    case 'select':
      return <SelectEditor property={property} value={value} onChange={onChange} />;
    case 'multi_select':
      return <MultiSelectEditor property={property} value={value} onChange={onChange} />;
    case 'date':
      return <DateEditor value={value} onChange={onChange} />;
    case 'checkbox':
      return <CheckboxEditor value={value} onChange={onChange} />;
    case 'url':
      return <UrlEditor value={value || ''} onChange={onChange} />;
    default:
      return <TextEditor value={value || ''} onChange={onChange} />;
  }
}

function TextEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [editValue, setEditValue] = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  const commit = useCallback(() => {
    if (editValue !== value) {
      onChange(editValue);
    }
  }, [editValue, value, onChange]);

  return (
    <input
      ref={ref}
      type="text"
      value={editValue}
      onChange={e => setEditValue(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); } }}
      style={inputStyle}
    />
  );
}

function NumberEditor({ value, onChange }: { value: any; onChange: (v: number | null) => void }) {
  const [editValue, setEditValue] = useState(value !== undefined && value !== null ? String(value) : '');
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditValue(value !== undefined && value !== null ? String(value) : '');
  }, [value]);

  const commit = useCallback(() => {
    const parsed = editValue === '' ? null : Number(editValue);
    if (parsed !== value) {
      onChange(parsed);
    }
  }, [editValue, value, onChange]);

  return (
    <input
      ref={ref}
      type="number"
      value={editValue}
      onChange={e => setEditValue(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); } }}
      style={inputStyle}
    />
  );
}

function SelectEditor({ property, value, onChange }: { property: DatabaseProperty; value: any; onChange: (v: string | null) => void }) {
  const selected = property.options.find(o => o.id === value);

  return (
    <select
      value={value || ''}
      onChange={e => onChange(e.target.value || null)}
      style={inputStyle}
    >
      <option value="">--</option>
      {property.options.map(opt => (
        <option key={opt.id} value={opt.id}>{opt.label}</option>
      ))}
    </select>
  );
}

function MultiSelectEditor({ property, value, onChange }: { property: DatabaseProperty; value: any; onChange: (v: string[]) => void }) {
  const selected = Array.isArray(value) ? value : [];

  const toggle = (optId: string) => {
    if (selected.includes(optId)) {
      onChange(selected.filter(id => id !== optId));
    } else {
      onChange([...selected, optId]);
    }
  };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '2px 4px', minHeight: 28, alignItems: 'center' }}>
      {property.options.map(opt => {
        const isSelected = selected.includes(opt.id);
        return (
          <button
            key={opt.id}
            onClick={() => toggle(opt.id)}
            style={{
              ...chipStyle,
              backgroundColor: isSelected ? (OPTION_COLORS[opt.color] || '#9ca3af') : 'transparent',
              color: isSelected ? '#fff' : 'var(--text-secondary)',
              border: `1px solid ${OPTION_COLORS[opt.color] || '#9ca3af'}`,
            }}
          >
            {opt.label}
          </button>
        );
      })}
      {property.options.length === 0 && (
        <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>No options</span>
      )}
    </div>
  );
}

function DateEditor({ value, onChange }: { value: any; onChange: (v: string | null) => void }) {
  const [editValue, setEditValue] = useState(value || '');
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditValue(value || '');
  }, [value]);

  const commit = useCallback(() => {
    if (editValue !== (value || '')) {
      onChange(editValue || null);
    }
  }, [editValue, value, onChange]);

  return (
    <input
      ref={ref}
      type="date"
      value={editValue}
      onChange={e => setEditValue(e.target.value)}
      onBlur={commit}
      style={inputStyle}
    />
  );
}

function CheckboxEditor({ value, onChange }: { value: any; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 32 }}>
      <input
        type="checkbox"
        checked={!!value}
        onChange={e => onChange(e.target.checked)}
        style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--accent)' }}
      />
    </div>
  );
}

function UrlEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [editValue, setEditValue] = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  const commit = useCallback(() => {
    if (editValue !== value) {
      onChange(editValue);
    }
  }, [editValue, value, onChange]);

  return (
    <input
      ref={ref}
      type="url"
      value={editValue}
      onChange={e => setEditValue(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); } }}
      style={inputStyle}
    />
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: 'none',
  outline: 'none',
  background: 'transparent',
  padding: '4px 8px',
  fontSize: 14,
  lineHeight: 1.5,
  color: 'inherit',
  fontFamily: 'inherit',
  minHeight: 32,
  boxSizing: 'border-box',
};

const chipStyle: React.CSSProperties = {
  padding: '2px 8px',
  borderRadius: 4,
  fontSize: 12,
  cursor: 'pointer',
  lineHeight: 1.4,
  whiteSpace: 'nowrap',
};