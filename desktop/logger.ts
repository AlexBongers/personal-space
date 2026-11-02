import { appendFileSync, renameSync, statSync } from "node:fs";
import { join } from "node:path";

const MAX_BYTES = 1_000_000;

/** Appends a timestamped line to app.log and keeps one older copy. Messages must never contain credentials. */
export const writeLog = (dataDir: string, message: string, now = new Date()) => {
  const path = join(dataDir, "app.log");
  try {
    if (statSync(path).size > MAX_BYTES) renameSync(path, `${path}.1`);
  } catch { /* No log file yet. */ }
  appendFileSync(path, `${now.toISOString()} ${message}\n`);
};
