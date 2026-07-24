import { Router, Request, Response } from 'express';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

interface PropertyRow {
  id: string;
  database_id: string;
  name: string;
  type: string;
  position: number;
  options: string;
  created_at: string;
}

interface RowRow {
  id: string;
  database_id: string;
  title: string;
  position: number;
  created_at: string;
  updated_at: string;
}

interface CellValueRow {
  id: string;
  row_id: string;
  property_id: string;
  value: string;
}

export function createDatabaseRouter(db: Database.Database): Router {
  const router = Router();

  // GET /api/databases/:id — full database (properties, rows, cells)
  router.get('/databases/:id', (req: Request, res: Response) => {
    const { id } = req.params;

    const page = db.prepare('SELECT * FROM pages WHERE id = ? AND type = ?').get(id, 'database') as any;
    if (!page) {
      res.status(404).json({ error: 'Database not found' });
      return;
    }

    const properties = db.prepare('SELECT * FROM properties WHERE database_id = ? ORDER BY position ASC').all(id) as PropertyRow[];
    const rows = db.prepare('SELECT * FROM rows WHERE database_id = ? ORDER BY position ASC').all(id) as RowRow[];

    const cells: Record<string, Record<string, any>> = {};
    if (rows.length > 0) {
      const rowIds = rows.map(r => r.id);
      const placeholders = rowIds.map(() => '?').join(',');
      const cellValues = db.prepare(`SELECT * FROM cell_values WHERE row_id IN (${placeholders})`).all(...rowIds) as CellValueRow[];
      for (const cell of cellValues) {
        if (!cells[cell.row_id]) {
          cells[cell.row_id] = {};
        }
        try {
          cells[cell.row_id][cell.property_id] = JSON.parse(cell.value);
        } catch {
          cells[cell.row_id][cell.property_id] = cell.value;
        }
      }
    }

    const parsedProperties = properties.map(p => ({
      ...p,
      options: JSON.parse(p.options),
    }));

    res.json({
      page,
      properties: parsedProperties,
      rows,
      cells,
    });
  });

  // POST /api/databases/:id/properties — add property
  router.post('/databases/:id/properties', (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, type, options } = req.body;

    const page = db.prepare('SELECT * FROM pages WHERE id = ? AND type = ?').get(id, 'database') as any;
    if (!page) {
      res.status(404).json({ error: 'Database not found' });
      return;
    }

    const validTypes = ['text', 'number', 'select', 'multi_select', 'date', 'checkbox', 'url'];
    if (!validTypes.includes(type)) {
      res.status(400).json({ error: `Invalid property type. Must be one of: ${validTypes.join(', ')}` });
      return;
    }

    const propId = uuidv4();
    const now = new Date().toISOString();

    const maxPos = db.prepare('SELECT COALESCE(MAX(position), -1) + 1 as pos FROM properties WHERE database_id = ?').get(id) as { pos: number };

    const optionsStr = options ? JSON.stringify(options) : '[]';

    db.prepare(
      'INSERT INTO properties (id, database_id, name, type, position, options, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(propId, id, name, type, maxPos.pos, optionsStr, now);

    const property = db.prepare('SELECT * FROM properties WHERE id = ?').get(propId) as PropertyRow;
    property.options = JSON.parse(property.options);

    res.status(201).json(property);
  });

  // PUT /api/properties/:id — update property
  router.put('/properties/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, options } = req.body;

    const existing = db.prepare('SELECT * FROM properties WHERE id = ?').get(id) as PropertyRow | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Property not found' });
      return;
    }

    if (name !== undefined) {
      db.prepare('UPDATE properties SET name = ? WHERE id = ?').run(name, id);
    }
    if (options !== undefined) {
      db.prepare('UPDATE properties SET options = ? WHERE id = ?').run(JSON.stringify(options), id);
    }

    const property = db.prepare('SELECT * FROM properties WHERE id = ?').get(id) as PropertyRow;
    property.options = JSON.parse(property.options);

    res.json(property);
  });

  // DELETE /api/properties/:id — delete property
  router.delete('/properties/:id', (req: Request, res: Response) => {
    const { id } = req.params;

    const existing = db.prepare('SELECT * FROM properties WHERE id = ?').get(id) as PropertyRow | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Property not found' });
      return;
    }

    db.prepare('DELETE FROM properties WHERE id = ?').run(id);
    res.status(204).send();
  });

  // PUT /api/properties/:id/reorder — reorder
  router.put('/properties/:id/reorder', (req: Request, res: Response) => {
    const { id } = req.params;
    const { propertyIds } = req.body;

    const existing = db.prepare('SELECT * FROM properties WHERE id = ?').get(id) as PropertyRow | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Property not found' });
      return;
    }

    const updateStmt = db.prepare('UPDATE properties SET position = ? WHERE id = ?');
    const txn = db.transaction(() => {
      for (let i = 0; i < propertyIds.length; i++) {
        updateStmt.run(i, propertyIds[i]);
      }
    });
    txn();

    const properties = db.prepare('SELECT * FROM properties WHERE database_id = ? ORDER BY position ASC').all(existing.database_id) as PropertyRow[];
    const parsed = properties.map(p => ({ ...p, options: JSON.parse(p.options) }));

    res.json(parsed);
  });

  // POST /api/databases/:id/rows — add row
  router.post('/databases/:id/rows', (req: Request, res: Response) => {
    const { id } = req.params;
    const { title } = req.body;

    const page = db.prepare('SELECT * FROM pages WHERE id = ? AND type = ?').get(id, 'database') as any;
    if (!page) {
      res.status(404).json({ error: 'Database not found' });
      return;
    }

    const rowId = uuidv4();
    const now = new Date().toISOString();

    const maxPos = db.prepare('SELECT COALESCE(MAX(position), -1) + 1 as pos FROM rows WHERE database_id = ?').get(id) as { pos: number };

    const rowTitle = title || 'Untitled';

    const txn = db.transaction(() => {
      // Create the row page entry (same id as row for easy lookup)
      db.prepare(
        'INSERT INTO pages (id, parent_id, title, icon, type, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(rowId, id, rowTitle, '', 'row', JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] }), now, now);

      // Create the row record
      db.prepare(
        'INSERT INTO rows (id, database_id, title, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(rowId, id, rowTitle, maxPos.pos, now, now);

      // Create empty cell values for all properties
      const properties = db.prepare('SELECT * FROM properties WHERE database_id = ?').all(id) as PropertyRow[];
      const insertCell = db.prepare(
        'INSERT INTO cell_values (id, row_id, property_id, value) VALUES (?, ?, ?, ?)'
      );
      for (const prop of properties) {
        const cellId = uuidv4();
        insertCell.run(cellId, rowId, prop.id, '""');
      }
    });
    txn();

    const row = db.prepare('SELECT * FROM rows WHERE id = ?').get(rowId) as RowRow;
    res.status(201).json(row);
  });

  // PUT /api/rows/:id — update row
  router.put('/rows/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const { title } = req.body;

    const existing = db.prepare('SELECT * FROM rows WHERE id = ?').get(id) as RowRow | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Row not found' });
      return;
    }

    const now = new Date().toISOString();

    if (title !== undefined) {
      db.prepare('UPDATE rows SET title = ?, updated_at = ? WHERE id = ?').run(title, now, id);
      // Also update the corresponding page entry
      db.prepare('UPDATE pages SET title = ?, updated_at = ? WHERE id = ? AND type = ?').run(title, now, id, 'row');
    } else {
      db.prepare('UPDATE rows SET updated_at = ? WHERE id = ?').run(now, id);
    }

    const row = db.prepare('SELECT * FROM rows WHERE id = ?').get(id) as RowRow;
    res.json(row);
  });

  // DELETE /api/rows/:id — delete row
  router.delete('/rows/:id', (req: Request, res: Response) => {
    const { id } = req.params;

    const existing = db.prepare('SELECT * FROM rows WHERE id = ?').get(id) as RowRow | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Row not found' });
      return;
    }

    const txn = db.transaction(() => {
      db.prepare('DELETE FROM pages WHERE id = ? AND type = ?').run(id, 'row');
      db.prepare('DELETE FROM rows WHERE id = ?').run(id);
    });
    txn();

    res.status(204).send();
  });

  // PUT /api/rows/:id/reorder — reorder
  router.put('/rows/:id/reorder', (req: Request, res: Response) => {
    const { id } = req.params;
    const { rowIds } = req.body;

    const existing = db.prepare('SELECT * FROM rows WHERE id = ?').get(id) as RowRow | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Row not found' });
      return;
    }

    const updateStmt = db.prepare('UPDATE rows SET position = ? WHERE id = ?');
    const txn = db.transaction(() => {
      for (let i = 0; i < rowIds.length; i++) {
        updateStmt.run(i, rowIds[i]);
      }
    });
    txn();

    const rows = db.prepare('SELECT * FROM rows WHERE database_id = ? ORDER BY position ASC').all(existing.database_id) as RowRow[];
    res.json(rows);
  });

  // PUT /api/cells/:id — update cell value
  router.put('/cells/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const { value } = req.body;

    const existing = db.prepare('SELECT * FROM cell_values WHERE id = ?').get(id) as CellValueRow | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Cell not found' });
      return;
    }

    const serialized = value !== undefined ? JSON.stringify(value) : '""';
    db.prepare('UPDATE cell_values SET value = ? WHERE id = ?').run(serialized, id);

    const cell = db.prepare('SELECT * FROM cell_values WHERE id = ?').get(id) as CellValueRow;
    let parsedValue: any;
    try {
      parsedValue = JSON.parse(cell.value);
    } catch {
      parsedValue = cell.value;
    }

    res.json({ ...cell, value: parsedValue });
  });

  // PUT /api/rows/:id/cells — batch update cells
  router.put('/rows/:id/cells', (req: Request, res: Response) => {
    const { id } = req.params;
    const updates = req.body;

    const existing = db.prepare('SELECT * FROM rows WHERE id = ?').get(id) as RowRow | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Row not found' });
      return;
    }

    const txn = db.transaction(() => {
      for (const [propertyId, value] of Object.entries(updates)) {
        const serialized = JSON.stringify(value);
        const cell = db.prepare('SELECT * FROM cell_values WHERE row_id = ? AND property_id = ?').get(id, propertyId) as CellValueRow | undefined;
        if (cell) {
          db.prepare('UPDATE cell_values SET value = ? WHERE id = ?').run(serialized, cell.id);
        } else {
          const cellId = uuidv4();
          db.prepare(
            'INSERT INTO cell_values (id, row_id, property_id, value) VALUES (?, ?, ?, ?)'
          ).run(cellId, id, propertyId, serialized);
        }
      }
    });
    txn();

    const cells = db.prepare('SELECT * FROM cell_values WHERE row_id = ?').all(id) as CellValueRow[];
    const result: Record<string, any> = {};
    for (const cell of cells) {
      try {
        result[cell.property_id] = JSON.parse(cell.value);
      } catch {
        result[cell.property_id] = cell.value;
      }
    }

    res.json(result);
  });

  return router;
}