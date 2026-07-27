import type { DB } from '../db.js';
import { newId } from '../ids.js';
import type { Page, PageKind, PageNode } from '../types.js';

interface PageRow {
  id: string;
  parent_id: string | null;
  kind: string;
  title: string;
  icon: string | null;
  position: number;
}

function toPage(row: PageRow): Page {
  return {
    id: row.id,
    parentId: row.parent_id,
    kind: row.kind as PageKind,
    title: row.title,
    icon: row.icon,
    position: row.position,
  };
}

export function getPage(db: DB, id: string): Page | null {
  const row = db.prepare('SELECT * FROM pages WHERE id = ?').get(id) as PageRow | undefined;
  return row ? toPage(row) : null;
}

/** All non-row pages, as a nested tree ordered by position. */
export function getTree(db: DB): PageNode[] {
  const rows = db
    .prepare("SELECT * FROM pages WHERE kind != 'row' ORDER BY position, title")
    .all() as PageRow[];
  const nodes = new Map<string, PageNode>();
  for (const row of rows) nodes.set(row.id, { ...toPage(row), children: [] });

  const roots: PageNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

function nextPosition(db: DB, parentId: string | null): number {
  const row = db
    .prepare(
      parentId === null
        ? 'SELECT COALESCE(MAX(position), -1) AS m FROM pages WHERE parent_id IS NULL'
        : 'SELECT COALESCE(MAX(position), -1) AS m FROM pages WHERE parent_id = ?',
    )
    .get(...(parentId === null ? [] : [parentId])) as { m: number };
  return row.m + 1;
}

export interface CreatePageInput {
  parentId?: string | null;
  title?: string;
  icon?: string | null;
  kind?: PageKind;
  id?: string;
}

export function createPage(db: DB, input: CreatePageInput = {}): Page {
  const parentId = input.parentId ?? null;
  if (parentId !== null && !getPage(db, parentId)) throw new NotFound('parent page not found');

  const page: Page = {
    id: input.id ?? newId('pg'),
    parentId,
    kind: input.kind ?? 'page',
    title: input.title === undefined ? 'Untitled' : asText(input.title),
    icon: input.icon === undefined || input.icon === null ? null : asText(input.icon),
    position: nextPosition(db, parentId),
  };
  db.prepare(
    'INSERT INTO pages (id, parent_id, kind, title, icon, position) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(page.id, page.parentId, page.kind, page.title, page.icon, page.position);
  return page;
}

export class NotFound extends Error {}

/** Titles, icons and block text come off the wire as JSON, so anything could arrive. */
export function asText(value: unknown): string {
  return typeof value === 'string' ? value : String(value);
}

export interface UpdatePageInput {
  title?: string;
  icon?: string | null;
  parentId?: string | null;
}

export function updatePage(db: DB, id: string, input: UpdatePageInput): Page {
  const page = getPage(db, id);
  if (!page) throw new NotFound('page not found');

  if (input.parentId !== undefined && input.parentId !== page.parentId) {
    if (input.parentId !== null) {
      if (input.parentId === id || isDescendant(db, input.parentId, id)) {
        throw new Error('cannot move a page inside itself');
      }
      if (!getPage(db, input.parentId)) throw new NotFound('parent page not found');
    }
    db.prepare('UPDATE pages SET parent_id = ?, position = ? WHERE id = ?').run(
      input.parentId,
      nextPosition(db, input.parentId),
      id,
    );
  }
  if (input.title !== undefined) {
    db.prepare('UPDATE pages SET title = ? WHERE id = ?').run(asText(input.title), id);
  }
  if (input.icon !== undefined) {
    db.prepare('UPDATE pages SET icon = ? WHERE id = ?').run(
      input.icon === null ? null : asText(input.icon),
      id,
    );
  }

  return getPage(db, id)!;
}

/** True when `candidate` sits somewhere below `ancestor` in the tree. */
export function isDescendant(db: DB, candidate: string, ancestor: string): boolean {
  let current = getPage(db, candidate);
  while (current?.parentId) {
    if (current.parentId === ancestor) return true;
    current = getPage(db, current.parentId);
  }
  return false;
}

/** Ids of a page and everything nested inside it. */
export function collectSubtree(db: DB, id: string): string[] {
  const ids: string[] = [];
  const queue = [id];
  const childrenOf = db.prepare('SELECT id FROM pages WHERE parent_id = ?');
  while (queue.length) {
    const current = queue.shift()!;
    ids.push(current);
    for (const child of childrenOf.all(current) as { id: string }[]) queue.push(child.id);
  }
  return ids;
}

/** Deletes a page and, by cascade, every page nested inside it. */
export function deletePage(db: DB, id: string): string[] {
  const page = getPage(db, id);
  if (!page) throw new NotFound('page not found');
  const removed = collectSubtree(db, id);
  db.prepare('DELETE FROM pages WHERE id = ?').run(id);
  return removed;
}

/** Rewrites sibling order under `parentId` to match the given id list. */
export function reorderPages(db: DB, parentId: string | null, orderedIds: string[]): void {
  const update = db.prepare('UPDATE pages SET position = ?, parent_id = ? WHERE id = ?');
  db.transaction(() => {
    orderedIds.forEach((id, index) => update.run(index, parentId, id));
  })();
}

/** Root-to-page chain, excluding the page itself. */
export function getBreadcrumb(db: DB, id: string): Page[] {
  const chain: Page[] = [];
  let current = getPage(db, id);
  while (current?.parentId) {
    const parent = getPage(db, current.parentId);
    if (!parent) break;
    chain.unshift(parent);
    current = parent;
  }
  return chain;
}
