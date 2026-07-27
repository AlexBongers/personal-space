import type { Router } from 'express';
import type { DB } from '../db.js';
import { listBlocks } from '../repo/blocks.js';
import { createDatabase, getDatabase } from '../repo/databases.js';
import {
  NotFound,
  createPage,
  deletePage,
  getBreadcrumb,
  getPage,
  getTree,
  reorderPages,
  updatePage,
} from '../repo/pages.js';
import { getRow, rowProperties } from '../repo/rows.js';
import { search } from '../repo/search.js';
import type { PageDetail } from '../types.js';

export function registerPageRoutes(api: Router, db: DB): void {
  api.get('/tree', (_req, res) => {
    res.json(getTree(db));
  });

  api.post('/pages', (req, res) => {
    const { parentId, title, icon, kind } = req.body ?? {};
    const page =
      kind === 'database'
        ? createDatabase(db, { parentId, title, icon })
        : createPage(db, { parentId, title, icon, kind });
    res.status(201).json(page);
  });

  api.get('/pages/:id', (req, res) => {
    const page = getPage(db, req.params.id);
    if (!page) throw new NotFound('page not found');

    const row = page.kind === 'row' ? getRow(db, page.id) : null;
    const detail: PageDetail = {
      page,
      blocks: listBlocks(db, page.id),
      breadcrumb: getBreadcrumb(db, page.id),
      database: page.kind === 'database' ? getDatabase(db, page.id) : null,
      row: row ? { values: row.values, properties: rowProperties(db, page.id) } : null,
    };
    res.json(detail);
  });

  api.patch('/pages/:id', (req, res) => {
    const { title, icon, parentId } = req.body ?? {};
    res.json(updatePage(db, req.params.id, { title, icon, parentId }));
  });

  api.delete('/pages/:id', (req, res) => {
    res.json({ removed: deletePage(db, req.params.id) });
  });

  api.get('/search', (req, res) => {
    res.json(search(db, String(req.query.q ?? '')));
  });

  api.post('/pages/reorder', (req, res) => {
    const { parentId, orderedIds } = req.body ?? {};
    reorderPages(db, parentId ?? null, orderedIds ?? []);
    res.json({ ok: true });
  });
}
