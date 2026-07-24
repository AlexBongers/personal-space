import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
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

  it('creates a page', async () => {
    const res = await request(app)
      .post('/api/pages')
      .send({ title: 'Test Page', icon: '📄' });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Test Page');
    expect(res.body.icon).toBe('📄');
    expect(res.body.id).toBeDefined();
  });

  it('returns all pages as a tree', async () => {
    const rootRes = await request(app)
      .post('/api/pages')
      .send({ title: 'Root' });
    const rootId = rootRes.body.id;

    await request(app)
      .post('/api/pages')
      .send({ title: 'Child', parent_id: rootId });

    const treeRes = await request(app).get('/api/pages');

    expect(treeRes.status).toBe(200);
    expect(treeRes.body.length).toBe(1);
    expect(treeRes.body[0].title).toBe('Root');
    expect(treeRes.body[0].children.length).toBe(1);
    expect(treeRes.body[0].children[0].title).toBe('Child');
  });

  it('renames a page', async () => {
    const createRes = await request(app)
      .post('/api/pages')
      .send({ title: 'Old Name' });
    const id = createRes.body.id;

    const putRes = await request(app)
      .put(`/api/pages/${id}`)
      .send({ title: 'New Name' });

    expect(putRes.status).toBe(200);
    expect(putRes.body.title).toBe('New Name');
  });

  it('deletes a page and cascades to children', async () => {
    const parentRes = await request(app)
      .post('/api/pages')
      .send({ title: 'Parent' });
    const parentId = parentRes.body.id;

    await request(app)
      .post('/api/pages')
      .send({ title: 'Child', parent_id: parentId });

    const delRes = await request(app).delete(`/api/pages/${parentId}`);
    expect(delRes.status).toBe(204);

    const getChildRes = await request(app).get('/api/pages');
    expect(getChildRes.body.length).toBe(0);
  });

  it('returns 404 for unknown page', async () => {
    const res = await request(app).get('/api/pages/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Page not found');
  });
});