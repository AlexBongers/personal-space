import express from 'express';
import cors from 'cors';
import { getDb } from './db';
import { seedDb } from './seed';
import { createPageRouter } from './routes/pages';
import { createDatabaseRouter } from './routes/databases';
import { createSearchRouter } from './routes/search';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const db = getDb();
seedDb(db);

app.use('/api/pages', createPageRouter(db));
app.use('/api', createDatabaseRouter(db));
app.use('/api/search', createSearchRouter(db));

app.get('/api/theme', (_req, res) => {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'theme'").get() as { value: string } | undefined;
  res.json({ theme: row?.value || 'light' });
});

app.put('/api/theme', (req, res) => {
  const { theme } = req.body;
  if (theme !== 'light' && theme !== 'dark') {
    res.status(400).json({ error: 'Theme must be light or dark' });
    return;
  }
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('theme', ?)").run(theme);
  res.json({ theme });
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Personal Space server running on http://localhost:${PORT}`);
});

export { app, db };