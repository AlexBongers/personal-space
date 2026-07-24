import { Router, Request, Response } from 'express';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

interface PageRow {
  id: string;
  parent_id: string | null;
  title: string;
  icon: string;
  type: string;
  content: string;
  created_at: string;
  updated_at: string;
}

interface PageTree extends PageRow {
  children: PageTree[];
}

export function createPageRouter(db: Database.Database): Router {
  const router = Router();

  // GET /api/pages — full tree
  router.get('/', (_req: Request, res: Response) => {
    const rows = db.prepare('SELECT * FROM pages ORDER BY created_at ASC').all() as PageRow[];
    const tree = buildTree(rows);
    res.json(tree);
  });

  // GET /api/pages/:id — single page
  router.get('/:id', (req: Request, res: Response) => {
    const page = db.prepare('SELECT * FROM pages WHERE id = ?').get(req.params.id) as PageRow | undefined;
    if (!page) {
      res.status(404).json({ error: 'Page not found' });
      return;
    }
    if (typeof page.content === 'string') {
      page.content = JSON.parse(page.content);
    }
    res.json(page);
  });

  // POST /api/pages — create
  router.post('/', (req: Request, res: Response) => {
    const { title, icon, parent_id, type } = req.body;
    const id = uuidv4();
    const now = new Date().toISOString();
    db.prepare(
      'INSERT INTO pages (id, parent_id, title, icon, type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(id, parent_id || null, title || 'Untitled', icon || '', type || 'page', now, now);
    const page = db.prepare('SELECT * FROM pages WHERE id = ?').get(id) as PageRow;
    if (typeof page.content === 'string') {
      page.content = JSON.parse(page.content);
    }
    res.status(201).json(page);
  });

  // PUT /api/pages/:id — update
  router.put('/:id', (req: Request, res: Response) => {
    const { title, icon, content } = req.body;
    const existing = db.prepare('SELECT * FROM pages WHERE id = ?').get(req.params.id) as PageRow | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Page not found' });
      return;
    }
    const now = new Date().toISOString();
    db.prepare(
      'UPDATE pages SET title = ?, icon = ?, content = ?, updated_at = ? WHERE id = ?'
    ).run(
      title !== undefined ? title : existing.title,
      icon !== undefined ? icon : existing.icon,
      content !== undefined ? JSON.stringify(content) : existing.content,
      now,
      req.params.id
    );
    const page = db.prepare('SELECT * FROM pages WHERE id = ?').get(req.params.id) as PageRow;
    if (typeof page.content === 'string') {
      page.content = JSON.parse(page.content);
    }
    res.json(page);
  });

  // DELETE /api/pages/:id — delete with cascade
  router.delete('/:id', (req: Request, res: Response) => {
    const existing = db.prepare('SELECT * FROM pages WHERE id = ?').get(req.params.id) as PageRow | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Page not found' });
      return;
    }
    db.prepare('DELETE FROM pages WHERE id = ?').run(req.params.id);
    res.status(204).send();
  });

  return router;
}

export function buildTree(rows: PageRow[]): PageTree[] {
  const map = new Map<string, PageTree>();
  const roots: PageTree[] = [];

  for (const row of rows) {
    map.set(row.id, { ...row, children: [] });
  }

  for (const row of rows) {
    const node = map.get(row.id)!;
    if (row.parent_id && map.has(row.parent_id)) {
      map.get(row.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}