import { createApp } from './app.js';
import { openDb } from './db.js';
import { seedIfEmpty } from './seed.js';

const PORT = Number(process.env.PORT ?? 8200);

const db = openDb(process.env.DB_PATH);
seedIfEmpty(db);

const server = createApp(db).listen(PORT, () => {
  console.log(`Personal Space running at http://localhost:${PORT}`);
});

/** Folds the write-ahead log back in, so the .sqlite file is the whole story. */
function shutdown(): void {
  server.close();
  db.close();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
