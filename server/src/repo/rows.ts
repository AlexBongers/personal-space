import type { DB } from '../db.js';
import type { PropertyValue, Row } from '../types.js';
import { NotFound, asText, createPage, deletePage, getPage } from './pages.js';
import { getProperty, listProperties } from './properties.js';

/** Coerces a raw value to whatever the property's type stores. */
export function coerce(type: string, value: unknown): PropertyValue {
  if (value === null || value === undefined || value === '') return null;
  switch (type) {
    case 'number': {
      const n = typeof value === 'number' ? value : Number(value);
      return Number.isFinite(n) ? n : null;
    }
    case 'checkbox':
      return value === true || value === 'true';
    case 'multi_select':
      return Array.isArray(value) ? value.map(String) : [String(value)];
    default:
      return String(value);
  }
}

export function readValues(db: DB, rowId: string): Record<string, PropertyValue> {
  const rows = db
    .prepare('SELECT property_id, value FROM row_values WHERE row_id = ?')
    .all(rowId) as { property_id: string; value: string | null }[];
  const values: Record<string, PropertyValue> = {};
  for (const row of rows) {
    values[row.property_id] = row.value === null ? null : (JSON.parse(row.value) as PropertyValue);
  }
  return values;
}

export function listRows(db: DB, databaseId: string): Row[] {
  const pages = db
    .prepare("SELECT id, title, position FROM pages WHERE parent_id = ? AND kind = 'row' ORDER BY position")
    .all(databaseId) as { id: string; title: string; position: number }[];
  return pages.map((page) => ({
    id: page.id,
    databaseId,
    title: page.title,
    position: page.position,
    values: readValues(db, page.id),
  }));
}

export function getRow(db: DB, id: string): Row | null {
  const page = getPage(db, id);
  if (!page || page.kind !== 'row' || !page.parentId) return null;
  return {
    id: page.id,
    databaseId: page.parentId,
    title: page.title,
    position: page.position,
    values: readValues(db, page.id),
  };
}

export interface CreateRowInput {
  title?: string;
  values?: Record<string, unknown>;
  id?: string;
}

export function createRow(db: DB, databaseId: string, input: CreateRowInput = {}): Row {
  const page = getPage(db, databaseId);
  if (!page) throw new NotFound('database not found');
  if (page.kind !== 'database') throw new Error('page is not a database');

  const created = createPage(db, {
    id: input.id,
    parentId: databaseId,
    kind: 'row',
    title: input.title ?? 'Untitled',
  });
  if (input.values) setValues(db, created.id, input.values);
  return getRow(db, created.id)!;
}

/** Writes cell values, ignoring properties that belong to another database. */
export function setValues(db: DB, rowId: string, values: Record<string, unknown>): void {
  const row = getRow(db, rowId);
  if (!row) throw new NotFound('row not found');

  const write = db.prepare(
    'INSERT INTO row_values (row_id, property_id, value) VALUES (?, ?, ?)' +
      ' ON CONFLICT(row_id, property_id) DO UPDATE SET value = excluded.value',
  );
  db.transaction(() => {
    for (const [propertyId, raw] of Object.entries(values)) {
      const property = getProperty(db, propertyId);
      if (!property || property.databaseId !== row.databaseId) continue;
      const value = coerce(property.type, raw);
      write.run(rowId, propertyId, value === null ? null : JSON.stringify(value));
    }
  })();
}

export function updateRow(
  db: DB,
  id: string,
  input: { title?: string; values?: Record<string, unknown> },
): Row {
  const row = getRow(db, id);
  if (!row) throw new NotFound('row not found');
  if (input.title !== undefined) {
    db.prepare('UPDATE pages SET title = ? WHERE id = ?').run(asText(input.title), id);
  }
  if (input.values) setValues(db, id, input.values);
  return getRow(db, id)!;
}

export function deleteRow(db: DB, id: string): void {
  if (!getRow(db, id)) throw new NotFound('row not found');
  deletePage(db, id);
}

/** Property definitions for the database a row belongs to. */
export function rowProperties(db: DB, rowId: string) {
  const row = getRow(db, rowId);
  if (!row) throw new NotFound('row not found');
  return listProperties(db, row.databaseId);
}
