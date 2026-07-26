# Personal Space

A personal knowledge manager you run on your own computer — a private, single-user take on
Notion. Pages and blocks, databases with table / board / list views, quick-find search, and
light / dark themes. Everything stays on your machine in a single SQLite file.

## Run it

Requires [Node.js](https://nodejs.org) 20 or newer. Then:

    npm start

That's it. The first run installs dependencies and builds the app, then it serves at
**http://localhost:8100** — open that in your browser. Your data lives in `data/personal-space.db`.

## Development

- `npm run dev` — API on :8100 plus Vite dev server with hot reload on :8101.
- `npm test` — unit tests with coverage (backend and frontend).
- `npm run e2e` — Playwright end-to-end suite against a real browser (`npm run build` first,
  and `npx playwright install chromium` once).

## Layout

- `server/` — Express 5 + better-sqlite3 API, serves the built frontend.
- `web/` — React 19 + Vite frontend.
- `e2e/` — Playwright tests (run on port 8150 with a throwaway database).
- [REQUIREMENTS.md](./REQUIREMENTS.md) — what this is, phase by phase, with success criteria.
