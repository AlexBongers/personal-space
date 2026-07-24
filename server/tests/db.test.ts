import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { initDb } from '../src/db';

describe('Database initialization', () => {
  it('creates all required tables', () => {
    const db = new Database(':memory:');
    initDb(db);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
    const tableNames = tables.map(t => t.name).sort();
    expect(tableNames).toContain('pages');
    expect(tableNames).toContain('blocks');
    expect(tableNames).toContain('properties');
    expect(tableNames).toContain('rows');
    expect(tableNames).toContain('cell_values');
    expect(tableNames).toContain('view_settings');
    expect(tableNames).toContain('settings');
  });

  it('sets WAL mode', () => {
    const db = new Database('/tmp/test-ps-wal.db');
    initDb(db);
    const result = db.prepare('PRAGMA journal_mode').get() as { journal_mode: string };
    expect(result.journal_mode).toBe('wal');
    db.close();
  });
});
