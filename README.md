# Personal Space

A personal knowledge manager inspired by Notion — pages, blocks, databases with table / board /
list views. Private, single-user, runs locally — everything stays on your machine.

## Features

- **Pages & Sidebar** — Nested page tree with emoji icons, create/rename/delete with confirmation
- **Rich Editor** — 11 block types (headings, lists, todos, quotes, code, callouts, divider), slash menu, drag-to-reorder, auto-save
- **Databases** — Table, board, and list views over typed properties (text, number, select, multi-select, date, checkbox, URL)
- **Search** — Quick-find with Ctrl+K / Cmd+K, live results across pages and database rows
- **Dark mode** — First-class light and dark themes, persisted across restarts
- **Seed data** — Ships pre-populated with a realistic workspace

## Quick Start

```bash
npm run dev
```

Opens the app at **http://localhost:8301**. One command, no accounts, no cloud required.

The server runs on port **8300** and is proxied through the Vite dev server on port **8301**.

## Production build

```bash
npm run build && npm start -w server
```

The production server on port **8300** serves both the API and the built client.

## Development

```bash
npm run test:unit    # Run server + client unit tests
npm run test:e2e     # Run Playwright end-to-end tests
npm run test         # Run all tests (unit + e2e)
npm run test:coverage -w server  # Server coverage report
npm run test:coverage -w client  # Client coverage report
```

## Architecture

- **Frontend**: React + TypeScript + Vite + CSS Modules
- **Backend**: Express + TypeScript + better-sqlite3
- **Testing**: Vitest (unit) + Playwright (e2e)

## Requirements

See [REQUIREMENTS.md](./REQUIREMENTS.md) for the full specification.
