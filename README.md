# Personal Space

A personal knowledge manager you run on your own computer — a private, single-user take on Notion.
Notes, plans and lists as free-form pages, plus databases you can view as tables, boards and lists.
One user, no login, everything stays on your machine.

## Start it

You need [Node.js](https://nodejs.org) 20 or newer. Then, in this folder:

```
npm install && npm start
```

Open **http://localhost:8200**. That's it — no accounts, no cloud, no internet needed.

The workspace comes pre-loaded, so there is something to look at from the first screen. Your data
lives in the `data/` folder, as a SQLite database; delete that folder to start over from the seeded
workspace.

## Other commands

| Command | What it does |
| --- | --- |
| `npm start` | Build everything and serve the app on port 8200 |
| `npm run dev` | Backend plus Vite dev server with hot reload (http://localhost:8201) |
| `npm test` | Unit tests, frontend and backend |
| `npm run test:coverage` | Unit tests with statement coverage |
| `npm run test:e2e` | End-to-end tests driving the real app in a real browser |

## How it is put together

- `server/` — Node, Express and SQLite (`better-sqlite3`). Owns the data and the JSON API, and
  serves the built frontend.
- `client/` — React and TypeScript, built with Vite. Drag and drop via `dnd-kit`.
- `e2e/` — Playwright tests against the real production build.

Domain types are declared once, in `server/src/types.ts`, and aliased into the client as `@shared`.

## Documents

- [REQUIREMENTS.md](./REQUIREMENTS.md) — what gets built, phase by phase, with success criteria.
- [ADVERSARIAL_REVIEW.md](./ADVERSARIAL_REVIEW.md) — findings from trying to break the product.
