import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { D1Database } from "./d1-sqlite.ts";
import { migrate } from "./migrate.ts";
import { startLocalServer } from "./server.ts";

/** Runs Personal Space as a plain local Node server, without Electron. Configuration comes from the environment. */
const root = resolve(import.meta.dirname, "..");
const dataDir = resolve(process.env.PERSONAL_SPACE_DATA || join(root, ".local-data"));
mkdirSync(dataDir, { recursive: true });

const database = new D1Database(join(dataDir, "personal-space.sqlite"));
migrate(database, join(root, "drizzle"));

const port = Number(process.env.PORT || 3210);
await startLocalServer({
  distDir: join(root, "dist"),
  database,
  port,
  env: {
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_TOKEN_ENCRYPTION_KEY: process.env.GOOGLE_TOKEN_ENCRYPTION_KEY,
    PARRO_TOKEN_ENCRYPTION_KEY: process.env.PARRO_TOKEN_ENCRYPTION_KEY,
    GOOGLE_CALENDAR_SYNC_ONLY: process.env.GOOGLE_CALENDAR_SYNC_ONLY,
  },
});
console.log(`Personal Space is running at http://localhost:${port}`);
