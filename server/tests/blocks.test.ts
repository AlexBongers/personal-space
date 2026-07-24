import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { initDb } from '../src/db';
import express from 'express';
import request from 'supertest';
import { createPageRouter } from '../src/routes/pages';

describe('Page content storage', () => {
  let db: Database.Database;
  let app: express.Express;

  beforeEach(() => {
    db = new Database(':memory:');
    initDb(db);
    app = express();
    app.use(express.json());
    app.use('/api/pages', createPageRouter(db));
  });

  afterEach(() => {
    db.close();
  });

  it('stores and retrieves content on a page', async () => {
    const createRes = await request(app)
      .post('/api/pages')
      .send({ title: 'Editor Test' });
    expect(createRes.status).toBe(201);
    const pageId = createRes.body.id;

    const tipTapDoc = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Hello world' }] }
      ]
    };
    const updateRes = await request(app)
      .put(`/api/pages/${pageId}`)
      .send({ content: tipTapDoc });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.content).toEqual(tipTapDoc);

    const getRes = await request(app).get(`/api/pages/${pageId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.content).toEqual(tipTapDoc);
  });

  it('returns empty content on a new page', async () => {
    const createRes = await request(app)
      .post('/api/pages')
      .send({ title: 'Empty Page' });
    const defaultDoc = { type: 'doc', content: [{ type: 'paragraph' }] };
    expect(createRes.body.content).toEqual(defaultDoc);
  });
});