import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  DatabaseDetail,
  Property,
  PropertyType,
  PropertyValue,
  Row,
  SelectOption,
  View,
} from '@shared';
import { api, newId } from './api.ts';
import { useDebounced } from './hooks.ts';

const PALETTE: SelectOption['color'][] = ['amber', 'blue', 'purple', 'green', 'red', 'gray'];

export function nextColor(index: number): SelectOption['color'] {
  return PALETTE[index % PALETTE.length];
}

/**
 * Local, optimistic state for one database. Every write is applied to state
 * first and then queued, so the table never waits on the network.
 */
export function useDatabase(initial: DatabaseDetail) {
  const [properties, setProperties] = useState<Property[]>(initial.properties);
  const [rows, setRows] = useState<Row[]>(initial.rows);
  const [views, setViews] = useState<View[]>(initial.views);

  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const enqueue = useCallback((work: () => Promise<unknown>) => {
    chain.current = chain.current.then(work, work).catch(() => {});
    return chain.current;
  }, []);

  const databaseId = initial.page.id;

  // Row titles are typed into directly, so they coalesce instead of firing per keystroke.
  const pendingTitles = useRef(new Map<string, string>());
  const flushTitles = useCallback(() => {
    const entries = [...pendingTitles.current];
    pendingTitles.current.clear();
    for (const [id, title] of entries) enqueue(() => api.updateRow(id, { title }));
  }, [enqueue]);
  const scheduleTitles = useDebounced(flushTitles, 350);
  useEffect(() => () => flushTitles(), [flushTitles]);

  const addProperty = (name: string, type: PropertyType) => {
    const property: Property = {
      id: newId('pr'),
      databaseId,
      name: name.trim() || 'Property',
      type,
      options: [],
      position: properties.length,
    };
    setProperties((current) => [...current, property]);
    enqueue(() =>
      api.createProperty(databaseId, { id: property.id, name: property.name, type }),
    );
    return property;
  };

  const renameProperty = (id: string, name: string) => {
    setProperties((current) => current.map((p) => (p.id === id ? { ...p, name } : p)));
    enqueue(() => api.updateProperty(id, { name }));
  };

  const removeProperty = (id: string) => {
    setProperties((current) => current.filter((p) => p.id !== id));
    setViews((current) =>
      current.map((view) => ({
        ...view,
        filters: view.filters.filter((f) => f.propertyId !== id),
        sort: view.sort?.propertyId === id ? null : view.sort,
        groupPropertyId: view.groupPropertyId === id ? null : view.groupPropertyId,
      })),
    );
    enqueue(() => api.deleteProperty(id));
  };

  /** Creates an option (reusing a same-named one) and returns its id. */
  const addOption = (propertyId: string, name: string): string | null => {
    const property = properties.find((p) => p.id === propertyId);
    const trimmed = name.trim();
    if (!property || !trimmed) return null;

    const existing = property.options.find((o) => o.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) return existing.id;

    const option: SelectOption = {
      id: newId('op'),
      name: trimmed,
      color: nextColor(property.options.length),
    };
    const options = [...property.options, option];
    setProperties((current) => current.map((p) => (p.id === propertyId ? { ...p, options } : p)));
    enqueue(() => api.updateProperty(propertyId, { options }));
    return option.id;
  };

  const addRow = (values: Row['values'] = {}) => {
    const row: Row = {
      id: newId('rw'),
      databaseId,
      title: 'Untitled',
      position: rows.length,
      values,
    };
    setRows((current) => [...current, row]);
    enqueue(() => api.createRow(databaseId, { id: row.id, title: row.title, values }));
    return row;
  };

  const renameRow = (id: string, title: string) => {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, title } : row)));
    pendingTitles.current.set(id, title);
    scheduleTitles();
  };

  const setCell = (rowId: string, propertyId: string, value: PropertyValue) => {
    setRows((current) =>
      current.map((row) =>
        row.id === rowId ? { ...row, values: { ...row.values, [propertyId]: value } } : row,
      ),
    );
    enqueue(() => api.updateRow(rowId, { values: { [propertyId]: value } }));
  };

  const removeRow = (id: string) => {
    setRows((current) => current.filter((row) => row.id !== id));
    enqueue(() => api.deleteRow(id));
  };

  const patchView = (id: string, patch: Partial<Omit<View, 'id' | 'databaseId' | 'kind'>>) => {
    setViews((current) => current.map((view) => (view.id === id ? { ...view, ...patch } : view)));
    enqueue(() => api.updateView(id, patch));
  };

  return {
    databaseId,
    properties,
    rows,
    views,
    addProperty,
    renameProperty,
    removeProperty,
    addOption,
    addRow,
    renameRow,
    setCell,
    removeRow,
    patchView,
  };
}

export type DatabaseStore = ReturnType<typeof useDatabase>;
