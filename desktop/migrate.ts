import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { D1Database } from "./d1-sqlite.ts";

/** Applies the drizzle migrations that have not run yet. Uses wrangler's bookkeeping table name. */
export const migrate = (database: D1Database, migrationsDir: string) => {
  database.exec("CREATE TABLE IF NOT EXISTS d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)");
  const journal = JSON.parse(readFileSync(join(migrationsDir, "meta", "_journal.json"), "utf8")) as { entries: { tag: string }[] };
  const applied = new Set((database.sqlite.prepare("SELECT name FROM d1_migrations").all() as { name: string }[]).map((row) => row.name));
  for (const { tag } of journal.entries) {
    const name = `${tag}.sql`;
    if (applied.has(name)) continue;
    const sql = readFileSync(join(migrationsDir, name), "utf8").replaceAll("--> statement-breakpoint", "");
    database.exec("BEGIN");
    try {
      database.exec(sql);
      database.sqlite.prepare("INSERT INTO d1_migrations (name) VALUES (?)").run(name);
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  }
};
