import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { D1Database } from "./d1-sqlite.ts";

const KEEP = 14;

/** Writes a consistent copy of the database into backups/. Returns false when today's backup already exists. */
export const backupDatabase = (database: D1Database, dataDir: string, now = new Date()) => {
  const dir = join(dataDir, "backups");
  mkdirSync(dir, { recursive: true });
  const day = now.toISOString().slice(0, 10);
  const name = `personal-space-${day}.sqlite`;
  if (readdirSync(dir).includes(name)) return false;
  database.exec(`VACUUM INTO '${join(dir, name).replaceAll("'", "''")}'`);
  const backups = readdirSync(dir).filter((file) => file.startsWith("personal-space-")).sort();
  for (const old of backups.slice(0, Math.max(0, backups.length - KEEP))) rmSync(join(dir, old));
  return true;
};
