import { useState, useEffect, useCallback } from 'react';
import { fetchDatabase, addProperty, deleteProperty, updateProperty, addRow, deleteRow, updateRow, batchUpdateCells, fetchPage } from '../api';
import type { DatabaseProperty, DatabaseRow, DatabaseData, Page } from '../api';
import TableView from './TableView';

interface DatabaseViewProps {
  pageId: string;
}

export default function DatabaseView({ pageId }: DatabaseViewProps) {
  const [data, setData] = useState<DatabaseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddProp, setShowAddProp] = useState(false);
  const [newPropName, setNewPropName] = useState('');
  const [newPropType, setNewPropType] = useState<string>('text');
  const [page, setPage] = useState<Page | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [dbData, pg] = await Promise.all([
        fetchDatabase(pageId),
        fetchPage(pageId),
      ]);
      setData(dbData);
      setPage(pg);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [pageId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAddProperty = useCallback(async () => {
    if (!newPropName.trim() || !data) return;
    try {
      const prop = await addProperty(pageId, { name: newPropName.trim(), type: newPropType });
      setData({
        ...data,
        properties: [...data.properties, prop],
      });
      setNewPropName('');
      setShowAddProp(false);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [newPropName, newPropType, data, pageId]);

  const handleDeleteProperty = useCallback(async (propId: string) => {
    if (!data) return;
    try {
      await deleteProperty(propId);
      setData({
        ...data,
        properties: data.properties.filter(p => p.id !== propId),
      });
    } catch (e) {
      setError((e as Error).message);
    }
  }, [data]);

  const handleAddRow = useCallback(async () => {
    if (!data) return;
    try {
      const row = await addRow(pageId);
      setData({
        ...data,
        rows: [...data.rows, row],
        cells: { ...data.cells, [row.id]: {} },
      });
    } catch (e) {
      setError((e as Error).message);
    }
  }, [data, pageId]);

  const handleDeleteRow = useCallback(async (rowId: string) => {
    if (!data) return;
    try {
      await deleteRow(rowId);
      const newCells = { ...data.cells };
      delete newCells[rowId];
      setData({
        ...data,
        rows: data.rows.filter(r => r.id !== rowId),
        cells: newCells,
      });
    } catch (e) {
      setError((e as Error).message);
    }
  }, [data]);

  const handleUpdateCell = useCallback(async (rowId: string, propertyId: string, value: any) => {
    if (!data) return;
    const prevValue = (data.cells[rowId] || {})[propertyId];
    setData({
      ...data,
      cells: {
        ...data.cells,
        [rowId]: {
          ...(data.cells[rowId] || {}),
          [propertyId]: value,
        },
      },
    });
    try {
      await batchUpdateCells(rowId, { [propertyId]: value });
    } catch (e) {
      setData({
        ...data,
        cells: {
          ...data.cells,
          [rowId]: {
            ...(data.cells[rowId] || {}),
            [propertyId]: prevValue,
          },
        },
      });
    }
  }, [data]);

  const handleRenameRow = useCallback(async (rowId: string, title: string) => {
    if (!data) return;
    try {
      await updateRow(rowId, { title });
      setData({
        ...data,
        rows: data.rows.map(r => r.id === rowId ? { ...r, title } : r),
      });
    } catch (e) {
      setError((e as Error).message);
    }
  }, [data]);

  const handleRenameProperty = useCallback(async (propertyId: string, name: string) => {
    if (!data) return;
    try {
      await updateProperty(propertyId, { name });
      setData({
        ...data,
        properties: data.properties.map(p => p.id === propertyId ? { ...p, name } : p),
      });
    } catch (e) {
      setError((e as Error).message);
    }
  }, [data]);

  if (loading) {
    return (
      <div style={{ padding: 32 }}>
        <div style={{ color: 'var(--text-secondary)' }}>Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 32 }}>
        <div style={{ color: 'var(--text-secondary)' }}>Error: {error}</div>
        <button onClick={loadData} style={{ marginTop: 12, padding: '8px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1200 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          {page?.icon && <span>{page.icon}</span>}
          {data.page.title}
        </h1>
      </div>

      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Properties
        </span>
        {data.properties.map(prop => (
          <span
            key={prop.id}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '2px 8px',
              borderRadius: 4,
              fontSize: 12,
              background: 'var(--bg-hover)',
              color: 'var(--text-secondary)',
            }}
          >
            {prop.name}
            <button
              onClick={() => handleDeleteProperty(prop.id)}
              style={{
                color: 'var(--text-muted)',
                fontSize: 14,
                lineHeight: 1,
                padding: 0,
                marginLeft: 2,
                cursor: 'pointer',
                border: 'none',
                background: 'transparent',
              }}
              title="Delete property"
            >
              ×
            </button>
          </span>
        ))}
        <button
          onClick={() => setShowAddProp(true)}
          style={{
            color: 'var(--text-muted)',
            fontSize: 12,
            padding: '2px 8px',
            borderRadius: 4,
            cursor: 'pointer',
            border: '1px dashed var(--border)',
            background: 'transparent',
          }}
        >
          + Add property
        </button>
      </div>

      {showAddProp && (
        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, padding: 12, background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)' }}>
          <input
            type="text"
            value={newPropName}
            onChange={e => setNewPropName(e.target.value)}
            placeholder="Property name"
            style={{
              padding: '6px 10px',
              borderRadius: 4,
              border: '1px solid var(--border)',
              background: 'var(--bg)',
              color: 'inherit',
              fontSize: 14,
              flex: 1,
            }}
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter') handleAddProperty(); if (e.key === 'Escape') setShowAddProp(false); }}
          />
          <select
            value={newPropType}
            onChange={e => setNewPropType(e.target.value)}
            style={{
              padding: '6px 10px',
              borderRadius: 4,
              border: '1px solid var(--border)',
              background: 'var(--bg)',
              color: 'inherit',
              fontSize: 14,
            }}
          >
            <option value="text">Text</option>
            <option value="number">Number</option>
            <option value="select">Select</option>
            <option value="multi_select">Multi-select</option>
            <option value="date">Date</option>
            <option value="checkbox">Checkbox</option>
            <option value="url">URL</option>
          </select>
          <button
            onClick={handleAddProperty}
            style={{
              padding: '6px 14px',
              borderRadius: 4,
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Add
          </button>
          <button
            onClick={() => { setShowAddProp(false); setNewPropName(''); }}
            style={{
              padding: '6px 10px',
              borderRadius: 4,
              background: 'transparent',
              color: 'var(--text-secondary)',
              border: 'none',
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            Cancel
          </button>
        </div>
      )}

      <TableView
        properties={data.properties}
        rows={data.rows}
        cells={data.cells}
        onUpdateCell={handleUpdateCell}
        onDeleteRow={handleDeleteRow}
        onAddRow={handleAddRow}
        onRenameRow={handleRenameRow}
        onRenameProperty={handleRenameProperty}
      />
    </div>
  );
}