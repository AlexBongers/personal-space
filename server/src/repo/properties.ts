import type { DB } from '../db.js';
import { newId } from '../ids.js';
import {
  OPTION_COLORS,
  PROPERTY_TYPES,
  type OptionColor,
  type Property,
  type PropertyType,
  type SelectOption,
} from '../types.js';
import { NotFound, getPage } from './pages.js';

interface PropertyRow {
  id: string;
  database_id: string;
  name: string;
  type: string;
  options: string;
  position: number;
}

function toProperty(row: PropertyRow): Property {
  return {
    id: row.id,
    databaseId: row.database_id,
    name: row.name,
    type: row.type as PropertyType,
    options: JSON.parse(row.options) as SelectOption[],
    position: row.position,
  };
}

function assertPropertyType(type: string): PropertyType {
  if (!PROPERTY_TYPES.includes(type as PropertyType)) {
    throw new Error(`unknown property type: ${type}`);
  }
  return type as PropertyType;
}

export function listProperties(db: DB, databaseId: string): Property[] {
  const rows = db
    .prepare('SELECT * FROM properties WHERE database_id = ? ORDER BY position')
    .all(databaseId) as PropertyRow[];
  return rows.map(toProperty);
}

export function getProperty(db: DB, id: string): Property | null {
  const row = db.prepare('SELECT * FROM properties WHERE id = ?').get(id) as PropertyRow | undefined;
  return row ? toProperty(row) : null;
}

export interface CreatePropertyInput {
  name?: string;
  type?: string;
  options?: SelectOption[];
  id?: string;
}

export function createProperty(db: DB, databaseId: string, input: CreatePropertyInput = {}): Property {
  const page = getPage(db, databaseId);
  if (!page) throw new NotFound('database not found');
  if (page.kind !== 'database') throw new Error('page is not a database');

  const max = db
    .prepare('SELECT COALESCE(MAX(position), -1) AS m FROM properties WHERE database_id = ?')
    .get(databaseId) as { m: number };

  const property: Property = {
    id: input.id ?? newId('pr'),
    databaseId,
    name: input.name?.trim() || 'Property',
    type: assertPropertyType(input.type ?? 'text'),
    options: input.options ?? [],
    position: max.m + 1,
  };
  db.prepare(
    'INSERT INTO properties (id, database_id, name, type, options, position) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(
    property.id,
    property.databaseId,
    property.name,
    property.type,
    JSON.stringify(property.options),
    property.position,
  );
  return property;
}

/** A property's type is fixed once created; only its name and options change. */
export function updateProperty(
  db: DB,
  id: string,
  input: { name?: string; options?: SelectOption[] },
): Property {
  const property = getProperty(db, id);
  if (!property) throw new NotFound('property not found');

  if (input.name !== undefined) {
    db.prepare('UPDATE properties SET name = ? WHERE id = ?').run(input.name.trim() || 'Property', id);
  }
  if (input.options !== undefined) {
    db.prepare('UPDATE properties SET options = ? WHERE id = ?').run(JSON.stringify(input.options), id);
  }
  return getProperty(db, id)!;
}

export function deleteProperty(db: DB, id: string): void {
  const property = getProperty(db, id);
  if (!property) throw new NotFound('property not found');
  db.prepare('DELETE FROM properties WHERE id = ?').run(id);
  db.prepare('DELETE FROM row_values WHERE property_id = ?').run(id);
  clearViewReferences(db, property.databaseId, id);
}

/** Drops filters, sorts and grouping that pointed at a removed property. */
function clearViewReferences(db: DB, databaseId: string, propertyId: string): void {
  const views = db
    .prepare('SELECT id, filters, sort, group_property_id FROM views WHERE database_id = ?')
    .all(databaseId) as {
    id: string;
    filters: string;
    sort: string | null;
    group_property_id: string | null;
  }[];

  for (const view of views) {
    const filters = (JSON.parse(view.filters) as { propertyId: string }[]).filter(
      (f) => f.propertyId !== propertyId,
    );
    const sort = view.sort ? (JSON.parse(view.sort) as { propertyId: string }) : null;
    db.prepare('UPDATE views SET filters = ?, sort = ?, group_property_id = ? WHERE id = ?').run(
      JSON.stringify(filters),
      sort && sort.propertyId === propertyId ? null : view.sort,
      view.group_property_id === propertyId ? null : view.group_property_id,
      view.id,
    );
  }
}

/** Options are user-defined; the palette cycles so colors stay distinct. */
export function nextColor(index: number): OptionColor {
  return OPTION_COLORS[index % OPTION_COLORS.length];
}
