import type { DB } from '../db.js';
import type { PageKind, SearchResult } from '../types.js';

interface SearchRow {
  id: string;
  title: string;
  icon: string | null;
  kind: string;
  parent_title: string | null;
}

/**
 * Matches page, database and row titles. Titles that start with the query come
 * first, then the rest, each alphabetically.
 */
export function search(db: DB, query: string, limit = 20): SearchResult[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const rows = db
    .prepare(
      `SELECT p.id, p.title, p.icon, p.kind, parent.title AS parent_title
         FROM pages p
         LEFT JOIN pages parent ON parent.id = p.parent_id
        WHERE p.title LIKE ? ESCAPE '\\'
        ORDER BY
          CASE WHEN LOWER(p.title) LIKE ? ESCAPE '\\' THEN 0 ELSE 1 END,
          LOWER(p.title)
        LIMIT ?`,
    )
    .all(`%${escapeLike(trimmed)}%`, `${escapeLike(trimmed.toLowerCase())}%`, limit) as SearchRow[];

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    icon: row.icon,
    kind: row.kind as PageKind,
    parentTitle: row.parent_title,
  }));
}

/** SQLite LIKE treats these as wildcards, so a literal search must escape them. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}
