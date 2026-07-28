import Database from "better-sqlite3";
import path from "path";

const DATA_DIR = path.join(__dirname, "..", "data");
const DB_PATH = path.join(DATA_DIR, "space.db");

let db: Database.Database;

export function initDb(dbPath?: string): void {
  const fs = require("fs");
  if (!dbPath) {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  db = new Database(dbPath ?? DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS pages (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      parent_id TEXT,
      icon TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (parent_id) REFERENCES pages(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS databases (
      id TEXT PRIMARY KEY,
      page_id TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      properties TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS rows (
      id TEXT PRIMARY KEY,
      database_id TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      data TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (database_id) REFERENCES databases(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS blocks (
      id TEXT PRIMARY KEY,
      page_id TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'paragraph',
      content TEXT NOT NULL DEFAULT '',
      position INTEGER NOT NULL DEFAULT 0,
      checked INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS views (
      id TEXT PRIMARY KEY,
      database_id TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'table',
      name TEXT NOT NULL DEFAULT '',
      filters TEXT NOT NULL DEFAULT '[]',
      sort_field TEXT,
      sort_direction TEXT NOT NULL DEFAULT 'asc',
      group_field TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (database_id) REFERENCES databases(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS select_options (
      id TEXT PRIMARY KEY,
      database_id TEXT NOT NULL,
      property_id TEXT NOT NULL,
      value TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT 'gray',
      position INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (database_id) REFERENCES databases(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS _seed_marker (
      id INTEGER PRIMARY KEY,
      seeded INTEGER NOT NULL DEFAULT 0
    );
  `);

  try {
    db.exec("ALTER TABLE rows ADD COLUMN page_id TEXT");
  } catch {
    // Column already exists
  }
}

export function getDb(): Database.Database {
  if (!db) {
    throw new Error("Database not initialized. Call initDb() first.");
  }
  return db;
}