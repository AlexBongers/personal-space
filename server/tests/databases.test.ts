import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import Database from 'better-sqlite3';
import { initDb } from '../src/db';
import { createPageRouter } from '../src/routes/pages';
import { createDatabaseRouter } from '../src/routes/databases';

function createTestApp() {
  const db = new Database(':memory:');
  initDb(db);
  const app = express();
  app.use(express.json());
  app.use('/api/pages', createPageRouter(db));
  app.use('/api', createDatabaseRouter(db));
  return { app, db };
}

async function createDatabase(app: express.Express): Promise<{ id: string; title: string }> {
  const res = await request(app)
    .post('/api/pages')
    .send({ title: 'Test DB', type: 'database' });
  return { id: res.body.id, title: res.body.title };
}

describe('Databases API', () => {
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

  describe('GET /api/databases/:id', () => {
    it('returns database with empty properties and rows', async () => {
      const database = await createDatabase(app);
      const res = await request(app).get(`/api/databases/${database.id}`);
      expect(res.status).toBe(200);
      expect(res.body.page.id).toBe(database.id);
      expect(res.body.properties).toEqual([]);
      expect(res.body.rows).toEqual([]);
      expect(res.body.cells).toEqual({});
    });

    it('returns 404 for non-database page', async () => {
      const pageRes = await request(app)
        .post('/api/pages')
        .send({ title: 'Regular Page' });
      const res = await request(app).get(`/api/databases/${pageRes.body.id}`);
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Database not found');
    });

    it('returns 404 for nonexistent id', async () => {
      const res = await request(app).get('/api/databases/nonexistent');
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/databases/:id/properties', () => {
    it('creates a text property', async () => {
      const database = await createDatabase(app);
      const res = await request(app)
        .post(`/api/databases/${database.id}/properties`)
        .send({ name: 'Name', type: 'text' });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Name');
      expect(res.body.type).toBe('text');
      expect(res.body.position).toBe(0);
      expect(res.body.id).toBeDefined();
      expect(res.body.options).toEqual([]);
    });

    it('creates a select property with options', async () => {
      const database = await createDatabase(app);
      const options = [
        { id: 'opt1', label: 'Option A', color: 'blue' },
        { id: 'opt2', label: 'Option B', color: 'green' },
      ];
      const res = await request(app)
        .post(`/api/databases/${database.id}/properties`)
        .send({ name: 'Status', type: 'select', options });
      expect(res.status).toBe(201);
      expect(res.body.type).toBe('select');
      expect(res.body.options).toEqual(options);
    });

    it('increments position for each new property', async () => {
      const database = await createDatabase(app);
      const p1 = await request(app)
        .post(`/api/databases/${database.id}/properties`)
        .send({ name: 'Prop 1', type: 'text' });
      expect(p1.body.position).toBe(0);

      const p2 = await request(app)
        .post(`/api/databases/${database.id}/properties`)
        .send({ name: 'Prop 2', type: 'number' });
      expect(p2.body.position).toBe(1);
    });

    it('rejects invalid property type', async () => {
      const database = await createDatabase(app);
      const res = await request(app)
        .post(`/api/databases/${database.id}/properties`)
        .send({ name: 'Bad', type: 'invalid_type' });
      expect(res.status).toBe(400);
    });

    it('returns 404 for nonexistent database', async () => {
      const res = await request(app)
        .post('/api/databases/nonexistent/properties')
        .send({ name: 'Name', type: 'text' });
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/properties/:id', () => {
    it('updates property name', async () => {
      const database = await createDatabase(app);
      const propRes = await request(app)
        .post(`/api/databases/${database.id}/properties`)
        .send({ name: 'Old Name', type: 'text' });
      const propId = propRes.body.id;

      const res = await request(app)
        .put(`/api/properties/${propId}`)
        .send({ name: 'New Name' });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('New Name');
    });

    it('updates property options', async () => {
      const database = await createDatabase(app);
      const propRes = await request(app)
        .post(`/api/databases/${database.id}/properties`)
        .send({ name: 'Status', type: 'select', options: [] });
      const propId = propRes.body.id;

      const newOptions = [{ id: 'x', label: 'New', color: 'red' }];
      const res = await request(app)
        .put(`/api/properties/${propId}`)
        .send({ options: newOptions });
      expect(res.status).toBe(200);
      expect(res.body.options).toEqual(newOptions);
    });

    it('returns 404 for nonexistent property', async () => {
      const res = await request(app)
        .put('/api/properties/nonexistent')
        .send({ name: 'New' });
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/properties/:id', () => {
    it('deletes a property', async () => {
      const database = await createDatabase(app);
      const propRes = await request(app)
        .post(`/api/databases/${database.id}/properties`)
        .send({ name: 'Name', type: 'text' });
      const propId = propRes.body.id;

      const delRes = await request(app).delete(`/api/properties/${propId}`);
      expect(delRes.status).toBe(204);

      const dbRes = await request(app).get(`/api/databases/${database.id}`);
      expect(dbRes.body.properties.length).toBe(0);
    });

    it('returns 404 for nonexistent property', async () => {
      const res = await request(app).delete('/api/properties/nonexistent');
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/properties/:id/reorder', () => {
    it('reorders properties', async () => {
      const database = await createDatabase(app);
      const p1 = await request(app)
        .post(`/api/databases/${database.id}/properties`)
        .send({ name: 'First', type: 'text' });
      const p2 = await request(app)
        .post(`/api/databases/${database.id}/properties`)
        .send({ name: 'Second', type: 'text' });

      const res = await request(app)
        .put(`/api/properties/${p1.body.id}/reorder`)
        .send({ propertyIds: [p2.body.id, p1.body.id] });
      expect(res.status).toBe(200);
      expect(res.body[0].id).toBe(p2.body.id);
      expect(res.body[1].id).toBe(p1.body.id);
    });

    it('returns 404 for nonexistent property', async () => {
      const res = await request(app)
        .put('/api/properties/nonexistent/reorder')
        .send({ propertyIds: ['a', 'b'] });
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/databases/:id/rows', () => {
    it('creates a row with a default title', async () => {
      const database = await createDatabase(app);
      const res = await request(app)
        .post(`/api/databases/${database.id}/rows`)
        .send({});
      expect(res.status).toBe(201);
      expect(res.body.title).toBe('Untitled');
      expect(res.body.database_id).toBe(database.id);
      expect(res.body.position).toBe(0);
    });

    it('creates a row with a custom title', async () => {
      const database = await createDatabase(app);
      const res = await request(app)
        .post(`/api/databases/${database.id}/rows`)
        .send({ title: 'My Row' });
      expect(res.status).toBe(201);
      expect(res.body.title).toBe('My Row');
    });

    it('creates a page entry for the row', async () => {
      const database = await createDatabase(app);
      const rowRes = await request(app)
        .post(`/api/databases/${database.id}/rows`)
        .send({ title: 'Row Page' });

      const pagesRes = await request(app).get('/api/pages');
      const dbNode = pagesRes.body.find((p: any) => p.id === database.id);
      expect(dbNode).toBeDefined();
      expect(dbNode.children.length).toBe(1);
      expect(dbNode.children[0].title).toBe('Row Page');
      expect(dbNode.children[0].type).toBe('row');
    });

    it('creates empty cell values for all properties', async () => {
      const database = await createDatabase(app);
      await request(app)
        .post(`/api/databases/${database.id}/properties`)
        .send({ name: 'Text', type: 'text' });
      await request(app)
        .post(`/api/databases/${database.id}/properties`)
        .send({ name: 'Number', type: 'number' });

      const rowRes = await request(app)
        .post(`/api/databases/${database.id}/rows`)
        .send({ title: 'Row With Cells' });

      const dbRes = await request(app).get(`/api/databases/${database.id}`);
      const rowCells = dbRes.body.cells[rowRes.body.id];
      expect(rowCells).toBeDefined();
      expect(Object.keys(rowCells).length).toBe(2);
    });

    it('returns 404 for nonexistent database', async () => {
      const res = await request(app)
        .post('/api/databases/nonexistent/rows')
        .send({});
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/rows/:id', () => {
    it('updates row title', async () => {
      const database = await createDatabase(app);
      const rowRes = await request(app)
        .post(`/api/databases/${database.id}/rows`)
        .send({ title: 'Old Title' });
      const rowId = rowRes.body.id;

      const res = await request(app)
        .put(`/api/rows/${rowId}`)
        .send({ title: 'New Title' });
      expect(res.status).toBe(200);
      expect(res.body.title).toBe('New Title');
    });

    it('returns 404 for nonexistent row', async () => {
      const res = await request(app)
        .put('/api/rows/nonexistent')
        .send({ title: 'New' });
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/rows/:id', () => {
    it('deletes a row', async () => {
      const database = await createDatabase(app);
      const rowRes = await request(app)
        .post(`/api/databases/${database.id}/rows`)
        .send({ title: 'To Delete' });
      const rowId = rowRes.body.id;

      const delRes = await request(app).delete(`/api/rows/${rowId}`);
      expect(delRes.status).toBe(204);

      const dbRes = await request(app).get(`/api/databases/${database.id}`);
      expect(dbRes.body.rows.length).toBe(0);
    });

    it('deletes the corresponding page entry', async () => {
      const database = await createDatabase(app);
      const rowRes = await request(app)
        .post(`/api/databases/${database.id}/rows`)
        .send({ title: 'Row To Delete' });

      await request(app).delete(`/api/rows/${rowRes.body.id}`);

      const pagesRes = await request(app).get('/api/pages');
      const dbNode = pagesRes.body.find((p: any) => p.id === database.id);
      expect(dbNode.children.length).toBe(0);
    });

    it('returns 404 for nonexistent row', async () => {
      const res = await request(app).delete('/api/rows/nonexistent');
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/rows/:id/reorder', () => {
    it('reorders rows', async () => {
      const database = await createDatabase(app);
      const r1 = await request(app)
        .post(`/api/databases/${database.id}/rows`)
        .send({ title: 'First' });
      const r2 = await request(app)
        .post(`/api/databases/${database.id}/rows`)
        .send({ title: 'Second' });

      const res = await request(app)
        .put(`/api/rows/${r1.body.id}/reorder`)
        .send({ rowIds: [r2.body.id, r1.body.id] });
      expect(res.status).toBe(200);
      expect(res.body[0].id).toBe(r2.body.id);
      expect(res.body[1].id).toBe(r1.body.id);
    });

    it('returns 404 for nonexistent row', async () => {
      const res = await request(app)
        .put('/api/rows/nonexistent/reorder')
        .send({ rowIds: ['a', 'b'] });
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/cells/:id', () => {
    it('updates a cell value', async () => {
      const database = await createDatabase(app);
      await request(app)
        .post(`/api/databases/${database.id}/properties`)
        .send({ name: 'Text', type: 'text' });
      const rowRes = await request(app)
        .post(`/api/databases/${database.id}/rows`)
        .send({ title: 'Row' });

      const cell = db.prepare('SELECT * FROM cell_values WHERE row_id = ?').get(rowRes.body.id) as any;

      const res = await request(app)
        .put(`/api/cells/${cell.id}`)
        .send({ value: 'Hello World' });
      expect(res.status).toBe(200);
      expect(res.body.value).toBe('Hello World');
    });

    it('updates a cell with number value', async () => {
      const database = await createDatabase(app);
      await request(app)
        .post(`/api/databases/${database.id}/properties`)
        .send({ name: 'Count', type: 'number' });
      const rowRes = await request(app)
        .post(`/api/databases/${database.id}/rows`)
        .send({ title: 'Row' });

      const cell = db.prepare('SELECT * FROM cell_values WHERE row_id = ?').get(rowRes.body.id) as any;

      const res = await request(app)
        .put(`/api/cells/${cell.id}`)
        .send({ value: 42 });
      expect(res.status).toBe(200);
      expect(res.body.value).toBe(42);
    });

    it('returns 404 for nonexistent cell', async () => {
      const res = await request(app)
        .put('/api/cells/nonexistent')
        .send({ value: 'test' });
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/rows/:id/cells', () => {
    it('batch updates cell values', async () => {
      const database = await createDatabase(app);
      const p1 = await request(app)
        .post(`/api/databases/${database.id}/properties`)
        .send({ name: 'Name', type: 'text' });
      const p2 = await request(app)
        .post(`/api/databases/${database.id}/properties`)
        .send({ name: 'Age', type: 'number' });
      const rowRes = await request(app)
        .post(`/api/databases/${database.id}/rows`)
        .send({ title: 'Row' });

      const res = await request(app)
        .put(`/api/rows/${rowRes.body.id}/cells`)
        .send({ [p1.body.id]: 'Alice', [p2.body.id]: 30 });
      expect(res.status).toBe(200);
      expect(res.body[p1.body.id]).toBe('Alice');
      expect(res.body[p2.body.id]).toBe(30);
    });

    it('returns 404 for nonexistent row', async () => {
      const res = await request(app)
        .put('/api/rows/nonexistent/cells')
        .send({});
      expect(res.status).toBe(404);
    });
  });

  describe('Full integration', () => {
    it('cascades deletion from properties to cell_values', async () => {
      const database = await createDatabase(app);
      const propRes = await request(app)
        .post(`/api/databases/${database.id}/properties`)
        .send({ name: 'Name', type: 'text' });
      const propId = propRes.body.id;

      const rowRes = await request(app)
        .post(`/api/databases/${database.id}/rows`)
        .send({});

      // Verify cell exists
      let dbRes = await request(app).get(`/api/databases/${database.id}`);
      expect(Object.keys(dbRes.body.cells[rowRes.body.id]).length).toBe(1);

      // Delete the property
      await request(app).delete(`/api/properties/${propId}`);

      // Cell should be gone (CASCADE)
      dbRes = await request(app).get(`/api/databases/${database.id}`);
      const remainingCells = dbRes.body.cells[rowRes.body.id] || {};
      expect(Object.keys(remainingCells).length).toBe(0);
      expect(dbRes.body.properties.length).toBe(0);
    });

    it('cascades deletion from database to everything', async () => {
      const database = await createDatabase(app);
      await request(app)
        .post(`/api/databases/${database.id}/properties`)
        .send({ name: 'Name', type: 'text' });
      await request(app)
        .post(`/api/databases/${database.id}/rows`)
        .send({});

      // Delete the database page
      await request(app).delete(`/api/pages/${database.id}`);

      // Everything should be gone
      const pagesRes = await request(app).get('/api/pages');
      expect(pagesRes.body.find((p: any) => p.id === database.id)).toBeUndefined();
    });

    it('full round-trip: create db, add props, add rows, set cells, read back', async () => {
      const database = await createDatabase(app);

      const p1 = await request(app)
        .post(`/api/databases/${database.id}/properties`)
        .send({ name: 'Task', type: 'text' });
      const p2 = await request(app)
        .post(`/api/databases/${database.id}/properties`)
        .send({ name: 'Done', type: 'checkbox' });

      const row1 = await request(app)
        .post(`/api/databases/${database.id}/rows`)
        .send({ title: 'First task' });
      const row2 = await request(app)
        .post(`/api/databases/${database.id}/rows`)
        .send({ title: 'Second task' });

      await request(app)
        .put(`/api/rows/${row1.body.id}/cells`)
        .send({ [p1.body.id]: 'Buy groceries', [p2.body.id]: false });
      await request(app)
        .put(`/api/rows/${row2.body.id}/cells`)
        .send({ [p1.body.id]: 'Write tests', [p2.body.id]: true });

      const dbRes = await request(app).get(`/api/databases/${database.id}`);
      expect(dbRes.body.properties.length).toBe(2);
      expect(dbRes.body.rows.length).toBe(2);
      expect(dbRes.body.cells[row1.body.id][p1.body.id]).toBe('Buy groceries');
      expect(dbRes.body.cells[row1.body.id][p2.body.id]).toBe(false);
      expect(dbRes.body.cells[row2.body.id][p1.body.id]).toBe('Write tests');
      expect(dbRes.body.cells[row2.body.id][p2.body.id]).toBe(true);
    });
  });

  describe('View settings API', () => {
    describe('GET /api/databases/:id/views', () => {
      it('returns empty object when no settings exist', async () => {
        const database = await createDatabase(app);
        const res = await request(app).get(`/api/databases/${database.id}/views`);
        expect(res.status).toBe(200);
        expect(res.body).toEqual({});
      });

      it('returns 404 for nonexistent database', async () => {
        const res = await request(app).get('/api/databases/nonexistent/views');
        expect(res.status).toBe(404);
      });
    });

    describe('PUT /api/databases/:id/views/:viewType', () => {
      it('saves and retrieves view settings', async () => {
        const database = await createDatabase(app);
        const settings = { filters: [], sort: null, groupBy: null };

        const putRes = await request(app)
          .put(`/api/databases/${database.id}/views/table`)
          .send(settings);
        expect(putRes.status).toBe(200);
        expect(putRes.body.settings).toEqual(settings);

        const getRes = await request(app).get(`/api/databases/${database.id}/views`);
        expect(getRes.status).toBe(200);
        expect(getRes.body.table).toEqual(settings);
      });

      it('saves board view settings with groupBy', async () => {
        const database = await createDatabase(app);
        const settings = { filters: [], sort: null, groupBy: 'some-prop-id' };

        const putRes = await request(app)
          .put(`/api/databases/${database.id}/views/board`)
          .send(settings);
        expect(putRes.status).toBe(200);
        expect(putRes.body.settings.groupBy).toBe('some-prop-id');
      });

      it('updates existing settings', async () => {
        const database = await createDatabase(app);

        await request(app)
          .put(`/api/databases/${database.id}/views/table`)
          .send({ filters: [], sort: null, groupBy: null });

        const updated = { filters: [], sort: { propertyId: 'p1', direction: 'asc' as const }, groupBy: null };
        const putRes = await request(app)
          .put(`/api/databases/${database.id}/views/table`)
          .send(updated);
        expect(putRes.status).toBe(200);
        expect(putRes.body.settings.sort).toEqual({ propertyId: 'p1', direction: 'asc' });
      });

      it('returns 404 for nonexistent database', async () => {
        const res = await request(app)
          .put('/api/databases/nonexistent/views/table')
          .send({ filters: [], sort: null, groupBy: null });
        expect(res.status).toBe(404);
      });

      it('rejects invalid view type', async () => {
        const database = await createDatabase(app);
        const res = await request(app)
          .put(`/api/databases/${database.id}/views/invalid`)
          .send({ filters: [], sort: null, groupBy: null });
        expect(res.status).toBe(400);
      });
    });
  });
});