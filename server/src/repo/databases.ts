import type { DB } from '../db.js';
import type { DatabaseDetail, Page } from '../types.js';
import { NotFound, createPage, getPage } from './pages.js';
import { createProperty, listProperties } from './properties.js';
import { listRows } from './rows.js';
import { createDefaultViews, listViews } from './views.js';

export interface CreateDatabaseInput {
  parentId?: string | null;
  title?: string;
  icon?: string | null;
  id?: string;
  /** The seed defines its own columns; new databases get a starter Status. */
  withStatus?: boolean;
}

/**
 * A database is a page plus its three views. New ones start with a Status
 * select so the board view means something from the first row.
 */
export function createDatabase(db: DB, input: CreateDatabaseInput = {}): Page {
  const page = createPage(db, {
    id: input.id,
    parentId: input.parentId ?? null,
    kind: 'database',
    title: input.title ?? 'Untitled database',
    icon: input.icon ?? '🗄️',
  });
  createDefaultViews(db, page.id);
  if (input.withStatus !== false) {
    createProperty(db, page.id, {
      name: 'Status',
      type: 'select',
      options: [
        { id: `${page.id}_todo`, name: 'To do', color: 'amber' },
        { id: `${page.id}_doing`, name: 'In progress', color: 'blue' },
        { id: `${page.id}_done`, name: 'Done', color: 'green' },
      ],
    });
  }
  return page;
}

export function getDatabase(db: DB, id: string): DatabaseDetail {
  const page = getPage(db, id);
  if (!page) throw new NotFound('database not found');
  if (page.kind !== 'database') throw new Error('page is not a database');

  let views = listViews(db, id);
  if (views.length === 0) views = createDefaultViews(db, id);

  return {
    page,
    properties: listProperties(db, id),
    rows: listRows(db, id),
    views,
  };
}
