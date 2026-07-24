import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'personal-space.db');

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!dbInstance) {
    dbInstance = new Database(DB_PATH);
    initDb(dbInstance);
  }
  return dbInstance;
}

export function initDb(db: Database.Database): void {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS pages (
      id         TEXT PRIMARY KEY,
      parent_id  TEXT REFERENCES pages(id) ON DELETE CASCADE,
      title      TEXT NOT NULL DEFAULT 'Untitled',
      icon       TEXT NOT NULL DEFAULT '',
      type       TEXT NOT NULL DEFAULT 'page' CHECK(type IN ('page', 'database', 'row')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS blocks (
      id         TEXT PRIMARY KEY,
      page_id    TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
      type       TEXT NOT NULL,
      content    TEXT NOT NULL DEFAULT '{}',
      position   INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS properties (
      id          TEXT PRIMARY KEY,
      database_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      type        TEXT NOT NULL CHECK(type IN ('text','number','select','multi_select','date','checkbox','url')),
      position    INTEGER NOT NULL,
      options     TEXT NOT NULL DEFAULT '[]',
      created_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rows (
      id          TEXT PRIMARY KEY,
      database_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
      title       TEXT NOT NULL DEFAULT 'Untitled',
      position    INTEGER NOT NULL,
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cell_values (
      id          TEXT PRIMARY KEY,
      row_id      TEXT NOT NULL REFERENCES rows(id) ON DELETE CASCADE,
      property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      value       TEXT NOT NULL DEFAULT '',
      UNIQUE(row_id, property_id)
    );

    CREATE TABLE IF NOT EXISTS view_settings (
      id          TEXT PRIMARY KEY,
      database_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
      view_type   TEXT NOT NULL CHECK(view_type IN ('table', 'board', 'list')),
      settings    TEXT NOT NULL DEFAULT '{}',
      UNIQUE(database_id, view_type)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}