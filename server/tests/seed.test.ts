import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { initDb } from '../src/db';
import { seedDb } from '../src/seed';

describe('Seed data', () => {
  it('populates pages when database is empty', () => {
    const db = new Database(':memory:');
    initDb(db);
    seedDb(db);
    const count = db.prepare('SELECT COUNT(*) as count FROM pages').get() as { count: number };
    expect(count.count).toBeGreaterThan(0);
  });

  it('does not seed when pages already exist', () => {
    const db = new Database(':memory:');
    initDb(db);
    db.prepare('INSERT INTO pages (id, title, icon, type, created_at, updated_at) VALUES (?, ?, ?, ?, datetime(), datetime())').run('test', 'Existing', '', 'page');
    seedDb(db);
    const count = db.prepare('SELECT COUNT(*) as count FROM pages').get() as { count: number };
    expect(count.count).toBe(1);
  });
});
