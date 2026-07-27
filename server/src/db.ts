import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

export const DEFAULT_DB_PATH = resolve(here, '../../data/personal-space.sqlite');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS pages (
  id         TEXT PRIMARY KEY,
  parent_id  TEXT REFERENCES pages(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL DEFAULT 'page',
  title      TEXT NOT NULL DEFAULT '',
  icon       TEXT,
  position   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS blocks (
  id        TEXT PRIMARY KEY,
  page_id   TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  type      TEXT NOT NULL DEFAULT 'paragraph',
  text      TEXT NOT NULL DEFAULT '',
  checked   INTEGER NOT NULL DEFAULT 0,
  position  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS properties (
  id          TEXT PRIMARY KEY,
  database_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL,
  options     TEXT NOT NULL DEFAULT '[]',
  position    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS row_values (
  row_id      TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  value       TEXT,
  PRIMARY KEY (row_id, property_id)
);

CREATE TABLE IF NOT EXISTS views (
  id                 TEXT PRIMARY KEY,
  database_id        TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  kind               TEXT NOT NULL,
  filters            TEXT NOT NULL DEFAULT '[]',
  sort               TEXT,
  group_property_id  TEXT
);

CREATE INDEX IF NOT EXISTS idx_pages_parent ON pages(parent_id);
CREATE INDEX IF NOT EXISTS idx_blocks_page ON blocks(page_id, position);
CREATE INDEX IF NOT EXISTS idx_properties_db ON properties(database_id, position);
CREATE INDEX IF NOT EXISTS idx_views_db ON views(database_id);
`;

export type DB = Database.Database;

/** Opens (or creates) the SQLite database and applies the schema. */
export function openDb(path: string = DEFAULT_DB_PATH): DB {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  return db;
}
