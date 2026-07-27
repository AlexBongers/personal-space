import { beforeEach, describe, expect, it } from 'vitest';
import { type DB, openDb } from '../db.js';
import {
  NotFound,
  collectSubtree,
  createPage,
  deletePage,
  getBreadcrumb,
  getPage,
  getTree,
  isDescendant,
  reorderPages,
  updatePage,
} from './pages.js';

let db: DB;

beforeEach(() => {
  db = openDb(':memory:');
});

describe('createPage', () => {
  it('creates a root page with defaults', () => {
    const page = createPage(db);
    expect(page.title).toBe('Untitled');
    expect(page.parentId).toBeNull();
    expect(page.kind).toBe('page');
    expect(getPage(db, page.id)).toEqual(page);
  });

  it('creates a nested page with an icon', () => {
    const parent = createPage(db, { title: 'Parent' });
    const child = createPage(db, { parentId: parent.id, title: 'Child', icon: '📄' });
    expect(child.parentId).toBe(parent.id);
    expect(child.icon).toBe('📄');
  });

  it('assigns increasing positions among siblings', () => {
    const a = createPage(db, { title: 'A' });
    const b = createPage(db, { title: 'B' });
    const c = createPage(db, { title: 'C' });
    expect([a.position, b.position, c.position]).toEqual([0, 1, 2]);
  });

  it('rejects an unknown parent', () => {
    expect(() => createPage(db, { parentId: 'nope' })).toThrow(NotFound);
  });
});

describe('getTree', () => {
  it('nests children under parents in position order', () => {
    const root = createPage(db, { title: 'Root', icon: '🏠' });
    const first = createPage(db, { parentId: root.id, title: 'First' });
    const second = createPage(db, { parentId: root.id, title: 'Second' });
    createPage(db, { parentId: first.id, title: 'Deep' });

    const tree = getTree(db);
    expect(tree).toHaveLength(1);
    expect(tree[0].title).toBe('Root');
    expect(tree[0].children.map((c) => c.title)).toEqual(['First', 'Second']);
    expect(tree[0].children[0].children[0].title).toBe('Deep');
    expect(second.parentId).toBe(root.id);
  });

  it('omits database rows from the tree', () => {
    const db1 = createPage(db, { title: 'Tasks', kind: 'database' });
    createPage(db, { parentId: db1.id, title: 'A row', kind: 'row' });
    const tree = getTree(db);
    expect(tree).toHaveLength(1);
    expect(tree[0].children).toHaveLength(0);
  });
});

describe('updatePage', () => {
  it('renames a page', () => {
    const page = createPage(db, { title: 'Old' });
    expect(updatePage(db, page.id, { title: 'New' }).title).toBe('New');
  });

  it('changes and clears the icon', () => {
    const page = createPage(db, { icon: '📄' });
    expect(updatePage(db, page.id, { icon: '🔥' }).icon).toBe('🔥');
    expect(updatePage(db, page.id, { icon: null }).icon).toBeNull();
  });

  it('moves a page to a new parent', () => {
    const a = createPage(db, { title: 'A' });
    const b = createPage(db, { title: 'B' });
    expect(updatePage(db, b.id, { parentId: a.id }).parentId).toBe(a.id);
    expect(getTree(db)).toHaveLength(1);
  });

  it('refuses to move a page inside itself or a descendant', () => {
    const a = createPage(db, { title: 'A' });
    const child = createPage(db, { parentId: a.id, title: 'Child' });
    expect(() => updatePage(db, a.id, { parentId: a.id })).toThrow(/inside itself/);
    expect(() => updatePage(db, a.id, { parentId: child.id })).toThrow(/inside itself/);
  });

  it('rejects an unknown page or parent', () => {
    const a = createPage(db);
    expect(() => updatePage(db, 'nope', { title: 'x' })).toThrow(NotFound);
    expect(() => updatePage(db, a.id, { parentId: 'nope' })).toThrow(NotFound);
  });
});

describe('deletePage', () => {
  it('deletes a leaf page', () => {
    const page = createPage(db);
    expect(deletePage(db, page.id)).toEqual([page.id]);
    expect(getPage(db, page.id)).toBeNull();
  });

  it('cascades to every nested page', () => {
    const root = createPage(db, { title: 'Root' });
    const child = createPage(db, { parentId: root.id, title: 'Child' });
    const grandchild = createPage(db, { parentId: child.id, title: 'Grandchild' });
    const sibling = createPage(db, { title: 'Sibling' });

    const removed = deletePage(db, root.id);
    expect(new Set(removed)).toEqual(new Set([root.id, child.id, grandchild.id]));
    expect(getPage(db, child.id)).toBeNull();
    expect(getPage(db, grandchild.id)).toBeNull();
    expect(getPage(db, sibling.id)).not.toBeNull();
  });

  it('rejects an unknown page', () => {
    expect(() => deletePage(db, 'nope')).toThrow(NotFound);
  });
});

describe('helpers', () => {
  it('collectSubtree lists the page and its descendants', () => {
    const root = createPage(db);
    const child = createPage(db, { parentId: root.id });
    expect(collectSubtree(db, root.id)).toEqual([root.id, child.id]);
  });

  it('isDescendant walks up the chain', () => {
    const root = createPage(db);
    const child = createPage(db, { parentId: root.id });
    const grandchild = createPage(db, { parentId: child.id });
    expect(isDescendant(db, grandchild.id, root.id)).toBe(true);
    expect(isDescendant(db, root.id, grandchild.id)).toBe(false);
  });

  it('reorderPages rewrites sibling order', () => {
    const a = createPage(db, { title: 'A' });
    const b = createPage(db, { title: 'B' });
    const c = createPage(db, { title: 'C' });
    reorderPages(db, null, [c.id, a.id, b.id]);
    expect(getTree(db).map((p) => p.title)).toEqual(['C', 'A', 'B']);
  });

  it('getBreadcrumb returns the ancestor chain root-first', () => {
    const root = createPage(db, { title: 'Root' });
    const child = createPage(db, { parentId: root.id, title: 'Child' });
    const grandchild = createPage(db, { parentId: child.id, title: 'Grandchild' });
    expect(getBreadcrumb(db, grandchild.id).map((p) => p.title)).toEqual(['Root', 'Child']);
    expect(getBreadcrumb(db, root.id)).toEqual([]);
  });
});

describe('text coercion at the boundary', () => {
  it('stores a non-string title as text', () => {
    const page = createPage(db, { title: 123 as unknown as string });
    expect(getPage(db, page.id)!.title).toBe('123');
    expect(updatePage(db, page.id, { title: 7 as unknown as string }).title).toBe('7');
  });

  it('stores a non-string icon as text and still clears it', () => {
    const page = createPage(db, { icon: 42 as unknown as string });
    expect(page.icon).toBe('42');
    expect(updatePage(db, page.id, { icon: null }).icon).toBeNull();
  });
});
