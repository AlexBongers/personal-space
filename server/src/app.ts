import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DB } from './db.js';
import { NotFound } from './repo/pages.js';
import { registerBlockRoutes } from './routes/blocks.js';
import { registerDatabaseRoutes } from './routes/databases.js';
import { registerPageRoutes } from './routes/pages.js';
import { seed } from './seed.js';

const here = dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = resolve(here, '../../client/dist');

/** Builds the Express app around an already-open database. */
export function createApp(db: DB): Express {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  const api = express.Router();
  registerPageRoutes(api, db);
  registerBlockRoutes(api, db);
  registerDatabaseRoutes(api, db);

  // Only for the end-to-end suite, so each test starts from the seeded workspace.
  if (process.env.ALLOW_TEST_RESET === '1') {
    api.post('/test/reset', (_req, res) => {
      db.exec('DELETE FROM pages; DELETE FROM blocks; DELETE FROM properties; DELETE FROM views;');
      seed(db);
      res.json({ ok: true });
    });
  }

  app.use('/api', api);

  if (existsSync(CLIENT_DIST)) {
    app.use(express.static(CLIENT_DIST));
    app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(join(CLIENT_DIST, 'index.html')));
  }

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    const status = err instanceof NotFound ? 404 : 400;
    res.status(status).json({ error: err.message });
  });

  return app;
}
