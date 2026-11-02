import { copyFileSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { D1Database } from "./d1-sqlite.ts";

const KEEP = 14;

const prune = (dir: string) => {
  const backups = readdirSync(dir).filter((file) => file.startsWith("personal-space-")).sort();
  for (const old of backups.slice(0, Math.max(0, backups.length - KEEP))) rmSync(join(dir, old));
};

/**
 * Writes a consistent copy of the database into backups/ and, when given, also into an extra folder
 * such as iCloud Drive. Returns false when today's backup already exists, unless `manual` asks for one now.
 * The latest 14 are kept in each folder.
 */
export const backupDatabase = (database: D1Database, dataDir: string, now = new Date(), extraDir = "", manual = false) => {
  const dir = join(dataDir, "backups");
  mkdirSync(dir, { recursive: true });
  const stamp = manual ? now.toISOString().slice(0, 16).replace("T", "-").replace(":", "") : now.toISOString().slice(0, 10);
  const name = `personal-space-${stamp}.sqlite`;
  if (readdirSync(dir).includes(name)) return false;
  database.exec(`VACUUM INTO '${join(dir, name).replaceAll("'", "''")}'`);
  prune(dir);
  if (extraDir) {
    mkdirSync(extraDir, { recursive: true });
    copyFileSync(join(dir, name), join(extraDir, name));
    prune(extraDir);
  }
  return true;
};
