import path from "node:path";
import { fileURLToPath } from "node:url";
import { openDb } from "./db.js";
import { createApp } from "./app.js";
import { seedIfEmpty } from "./seed.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dbPath = process.env.DB_PATH ?? path.join(root, "data", "personal-space.db");
const port = Number(process.env.PORT ?? 8100);

const db = openDb(dbPath);
seedIfEmpty(db);
createApp(db).listen(port, () => {
  console.log(`Personal Space running at http://localhost:${port}`);
});
