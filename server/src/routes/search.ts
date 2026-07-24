import { Router, Request, Response } from 'express';
import Database from 'better-sqlite3';

interface SearchResult {
  id: string;
  title: string;
  icon: string;
  type: 'page' | 'database' | 'row';
}

export function createSearchRouter(db: Database.Database): Router {
  const router = Router();

  router.get('/', (req: Request, res: Response) => {
    const q = (req.query.q as string || '').trim();
    if (!q) {
      res.json([]);
      return;
    }

    const pattern = `%${q}%`;
    const results: SearchResult[] = [];

    const pages = db.prepare(
      `SELECT id, title, icon, type FROM pages WHERE title LIKE ? COLLATE NOCASE AND type IN ('page', 'database') LIMIT 20`
    ).all(pattern) as SearchResult[];

    for (const p of pages) {
      results.push({ id: p.id, title: p.title, icon: p.icon, type: p.type as 'page' | 'database' });
    }

    if (results.length < 20) {
      const remaining = 20 - results.length;
      const rows = db.prepare(
        `SELECT id, title, '' as icon FROM rows WHERE title LIKE ? COLLATE NOCASE LIMIT ?`
      ).all(pattern, remaining) as { id: string; title: string }[];

      for (const r of rows) {
        results.push({ id: r.id, title: r.title, icon: '', type: 'row' });
      }
    }

    res.json(results);
  });

  return router;
}