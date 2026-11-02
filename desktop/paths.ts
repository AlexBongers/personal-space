import { join } from "node:path";

/** Every file the desktop app keeps in its data folder (~/Library/Application Support/personal-space). */
export const appPaths = (dataDir: string) => ({
  dataDir,
  database: join(dataDir, "personal-space.sqlite"),
  config: join(dataDir, "config.json"),
  reminders: join(dataDir, "reminders.json"),
  notifyState: join(dataDir, "notify-state.json"),
  windowBounds: join(dataDir, "window.json"),
  log: join(dataDir, "app.log"),
  backups: join(dataDir, "backups"),
});

export type AppPaths = ReturnType<typeof appPaths>;
