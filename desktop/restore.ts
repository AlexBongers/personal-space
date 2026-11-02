import { copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

/** Replaces the database file with a backup. The caller must have closed the database first. The old file is kept in backups/. */
export const restoreBackup = (dataDir: string, backupPath: string, now = new Date()) => {
  const databasePath = join(dataDir, "personal-space.sqlite");
  const backups = join(dataDir, "backups");
  mkdirSync(backups, { recursive: true });
  if (existsSync(databasePath)) copyFileSync(databasePath, join(backups, `before-restore-${now.toISOString().replaceAll(":", "-")}.sqlite`));
  for (const suffix of ["-wal", "-shm"]) rmSync(`${databasePath}${suffix}`, { force: true });
  copyFileSync(backupPath, databasePath);
};
