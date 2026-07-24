import express from 'express';
import cors from 'cors';
import { getDb } from './db';
import { createPageRouter } from './routes/pages';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const db = getDb();

app.use('/api/pages', createPageRouter(db));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Personal Space server running on http://localhost:${PORT}`);
});

export { app, db };