import type { DB } from '../db.js';
import { newId } from '../ids.js';
import type { Filter, Sort, View, ViewKind } from '../types.js';
import { NotFound } from './pages.js';

const VIEW_KINDS: ViewKind[] = ['table', 'board', 'list'];

interface ViewRow {
  id: string;
  database_id: string;
  kind: string;
  filters: string;
  sort: string | null;
  group_property_id: string | null;
}

function toView(row: ViewRow): View {
  return {
    id: row.id,
    databaseId: row.database_id,
    kind: row.kind as ViewKind,
    filters: JSON.parse(row.filters) as Filter[],
    sort: row.sort ? (JSON.parse(row.sort) as Sort) : null,
    groupPropertyId: row.group_property_id,
  };
}

export function listViews(db: DB, databaseId: string): View[] {
  const rows = db.prepare('SELECT * FROM views WHERE database_id = ?').all(databaseId) as ViewRow[];
  const byKind = new Map(rows.map((row) => [row.kind, toView(row)]));
  return VIEW_KINDS.map((kind) => byKind.get(kind)).filter((view): view is View => Boolean(view));
}

export function getView(db: DB, id: string): View | null {
  const row = db.prepare('SELECT * FROM views WHERE id = ?').get(id) as ViewRow | undefined;
  return row ? toView(row) : null;
}

/** Every database gets exactly one view of each kind. */
export function createDefaultViews(db: DB, databaseId: string): View[] {
  for (const kind of VIEW_KINDS) {
    db.prepare('INSERT INTO views (id, database_id, kind) VALUES (?, ?, ?)').run(
      newId('vw'),
      databaseId,
      kind,
    );
  }
  return listViews(db, databaseId);
}

export interface UpdateViewInput {
  filters?: Filter[];
  sort?: Sort | null;
  groupPropertyId?: string | null;
}

export function updateView(db: DB, id: string, input: UpdateViewInput): View {
  if (!getView(db, id)) throw new NotFound('view not found');

  if (input.filters !== undefined) {
    db.prepare('UPDATE views SET filters = ? WHERE id = ?').run(JSON.stringify(input.filters), id);
  }
  if (input.sort !== undefined) {
    db.prepare('UPDATE views SET sort = ? WHERE id = ?').run(
      input.sort ? JSON.stringify(input.sort) : null,
      id,
    );
  }
  if (input.groupPropertyId !== undefined) {
    db.prepare('UPDATE views SET group_property_id = ? WHERE id = ?').run(input.groupPropertyId, id);
  }
  return getView(db, id)!;
}
