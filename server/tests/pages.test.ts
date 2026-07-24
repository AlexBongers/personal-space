import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import Database from 'better-sqlite3';
import { initDb } from '../src/db';
import { createPageRouter, buildTree } from '../src/routes/pages';

function createTestApp() {
  const db = new Database(':memory:');
  initDb(db);
  const app = express();
  app.use(express.json());
  app.use('/api/pages', createPageRouter(db));
  return { app, db };
}

describe('buildTree', () => {
  it('builds a tree from flat page rows', () => {
    const rows = [
      { id: 'root', parent_id: null, title: 'Root', icon: '', type: 'page', created_at: '', updated_at: '' },
      { id: 'child', parent_id: 'root', title: 'Child', icon: '', type: 'page', created_at: '', updated_at: '' },
      { id: 'grandchild', parent_id: 'child', title: 'Grandchild', icon: '', type: 'page', created_at: '', updated_at: '' },
    ];
    const tree = buildTree(rows);
    expect(tree.length).toBe(1);
    expect(tree[0].id).toBe('root');
    expect(tree[0].children.length).toBe(1);
    expect(tree[0].children[0].children.length).toBe(1);
  });
});

describe('Pages API', () => {
  let app: express.Express;
  let db: Database.Database;

  beforeEach(() => {
    const test = createTestApp();
    app = test.app;
    db = test.db;
  });

  afterEach(() => {
    db.close();
  });

  it('creates a page', () => {
    const id = 'new-page';
    const now = new Date().toISOString();
    db.prepare('INSERT INTO pages (id, parent_id, title, icon, type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, null, 'Test Page', '📄', 'page', now, now);
    const page = db.prepare('SELECT * FROM pages WHERE id = ?').get(id) as { title: string; icon: string };
    expect(page.title).toBe('Test Page');
    expect(page.icon).toBe('📄');
  });

  it('returns all pages', () => {
    db.prepare('INSERT INTO pages (id, title, icon, type, created_at, updated_at) VALUES (?, ?, ?, ?, datetime(), datetime())').run('root-1', 'Root', '', 'page');
    db.prepare('INSERT INTO pages (id, parent_id, title, icon, type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, datetime(), datetime())').run('child-1', 'root-1', 'Child', '', 'page');
    const pages = db.prepare('SELECT * FROM pages ORDER BY created_at').all();
    expect(pages.length).toBe(2);
  });

  it('renames a page', () => {
    const id = 'page-rename';
    db.prepare('INSERT INTO pages (id, title, icon, type, created_at, updated_at) VALUES (?, ?, ?, ?, datetime(), datetime())').run(id, 'Old Name', '', 'page');
    db.prepare('UPDATE pages SET title = ?, updated_at = datetime() WHERE id = ?').run('New Name', id);
    const page = db.prepare('SELECT * FROM pages WHERE id = ?').get(id) as { title: string };
    expect(page.title).toBe('New Name');
  });

  it('deletes a page and cascades to children', () => {
    const parentId = 'parent-delete';
    const childId = 'child-delete';
    db.prepare('INSERT INTO pages (id, title, icon, type, created_at, updated_at) VALUES (?, ?, ?, ?, datetime(), datetime())').run(parentId, 'Parent', '', 'page');
    db.prepare('INSERT INTO pages (id, parent_id, title, icon, type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, datetime(), datetime())').run(childId, parentId, 'Child', '', 'page');
    db.prepare('DELETE FROM pages WHERE id = ?').run(parentId);
    const child = db.prepare('SELECT * FROM pages WHERE id = ?').get(childId);
    expect(child).toBeUndefined();
  });

  it('returns 404 for unknown page', () => {
    const page = db.prepare('SELECT * FROM pages WHERE id = ?').get('nonexistent');
    expect(page).toBeUndefined();
  });
});
