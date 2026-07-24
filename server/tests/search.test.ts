import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import Database from 'better-sqlite3';
import { initDb } from '../src/db';
import { createSearchRouter } from '../src/routes/search';
import { createPageRouter } from '../src/routes/pages';
import { createDatabaseRouter } from '../src/routes/databases';

function createTestApp() {
  const db = new Database(':memory:');
  initDb(db);
  const app = express();
  app.use(express.json());
  app.use('/api/pages', createPageRouter(db));
  app.use('/api', createDatabaseRouter(db));
  app.use('/api/search', createSearchRouter(db));
  return { app, db };
}

describe('Search API', () => {
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

  it('returns empty results for empty query', async () => {
    const res = await request(app).get('/api/search?q=');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns empty results for whitespace-only query', async () => {
    const res = await request(app).get('/api/search?q=%20%20');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('searches page titles', async () => {
    await request(app)
      .post('/api/pages')
      .send({ title: 'Hello World', icon: '🌍' });
    await request(app)
      .post('/api/pages')
      .send({ title: 'Goodbye World', icon: '👋' });

    const res = await request(app).get('/api/search?q=hello');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].title).toBe('Hello World');
    expect(res.body[0].icon).toBe('🌍');
    expect(res.body[0].type).toBe('page');
    expect(res.body[0].id).toBeDefined();
  });

  it('searches is case-insensitive', async () => {
    await request(app)
      .post('/api/pages')
      .send({ title: 'UpperCase Page' });

    const res = await request(app).get('/api/search?q=uppercase');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].title).toBe('UpperCase Page');
  });

  it('searches database titles', async () => {
    await request(app)
      .post('/api/pages')
      .send({ title: 'Travel Plans', type: 'database' });

    const res = await request(app).get('/api/search?q=travel');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].type).toBe('database');
  });

  it('searches row titles', async () => {
    const dbRes = await request(app)
      .post('/api/pages')
      .send({ title: 'Projects', type: 'database' });
    const dbId = dbRes.body.id;

    await request(app)
      .post(`/api/databases/${dbId}/rows`)
      .send({ title: 'Important Project' });

    const res = await request(app).get('/api/search?q=important');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].type).toBe('row');
    expect(res.body[0].title).toBe('Important Project');
  });

  it('limits results to 20', async () => {
    for (let i = 0; i < 25; i++) {
      await request(app)
        .post('/api/pages')
        .send({ title: `Test Page ${i}` });
    }

    const res = await request(app).get('/api/search?q=Test');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeLessThanOrEqual(20);
  });

  it('returns results with correct shape', async () => {
    await request(app)
      .post('/api/pages')
      .send({ title: 'My Page', icon: '📄' });

    const res = await request(app).get('/api/search?q=My');
    const item = res.body[0];
    expect(item).toHaveProperty('id');
    expect(item).toHaveProperty('title');
    expect(item).toHaveProperty('icon');
    expect(item).toHaveProperty('type');
    expect(['page', 'database', 'row']).toContain(item.type);
  });
});