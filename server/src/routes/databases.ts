import type { Router } from 'express';
import type { DB } from '../db.js';
import { getDatabase } from '../repo/databases.js';
import { createProperty, deleteProperty, updateProperty } from '../repo/properties.js';
import { createRow, deleteRow, updateRow } from '../repo/rows.js';
import { updateView } from '../repo/views.js';

export function registerDatabaseRoutes(api: Router, db: DB): void {
  api.get('/databases/:id', (req, res) => {
    res.json(getDatabase(db, req.params.id));
  });

  api.post('/databases/:id/properties', (req, res) => {
    const { id, name, type, options } = req.body ?? {};
    res.status(201).json(createProperty(db, req.params.id, { id, name, type, options }));
  });

  api.patch('/properties/:id', (req, res) => {
    const { name, options } = req.body ?? {};
    res.json(updateProperty(db, req.params.id, { name, options }));
  });

  api.delete('/properties/:id', (req, res) => {
    deleteProperty(db, req.params.id);
    res.json({ ok: true });
  });

  api.post('/databases/:id/rows', (req, res) => {
    const { id, title, values } = req.body ?? {};
    res.status(201).json(createRow(db, req.params.id, { id, title, values }));
  });

  api.patch('/rows/:id', (req, res) => {
    const { title, values } = req.body ?? {};
    res.json(updateRow(db, req.params.id, { title, values }));
  });

  api.delete('/rows/:id', (req, res) => {
    deleteRow(db, req.params.id);
    res.json({ ok: true });
  });

  api.patch('/views/:id', (req, res) => {
    const { filters, sort, groupPropertyId } = req.body ?? {};
    res.json(updateView(db, req.params.id, { filters, sort, groupPropertyId }));
  });
}
