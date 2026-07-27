import type { Router } from 'express';
import type { DB } from '../db.js';
import { createBlock, deleteBlock, reorderBlocks, updateBlock } from '../repo/blocks.js';

export function registerBlockRoutes(api: Router, db: DB): void {
  api.post('/pages/:id/blocks', (req, res) => {
    const { id, type, text, checked, afterId } = req.body ?? {};
    res.status(201).json(createBlock(db, req.params.id, { id, type, text, checked, afterId }));
  });

  api.patch('/blocks/:id', (req, res) => {
    const { type, text, checked } = req.body ?? {};
    res.json(updateBlock(db, req.params.id, { type, text, checked }));
  });

  api.delete('/blocks/:id', (req, res) => {
    deleteBlock(db, req.params.id);
    res.json({ ok: true });
  });

  api.post('/pages/:id/blocks/reorder', (req, res) => {
    res.json(reorderBlocks(db, req.params.id, req.body?.orderedIds ?? []));
  });
}
