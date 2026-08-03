# Personal Space

Personal Space is a private, local-first knowledge manager for pages, notes, projects and
databases. It is designed to feel calm enough for daily use while still being capable of holding
the messy middle of real work.

## Run it

Install dependencies once, then start the app with one command:

```bash
npm install
npm run dev
```

Open the local URL printed by the command. The first launch includes a complete example workspace
with nested pages, a reading list, a project tracker, a travel plan and every editor block type.

## What is included

- Nested pages with emoji icons, rename, cascade delete and local autosave.
- Paragraphs, headings, lists, to-dos, quotes, dividers, code and callouts.
- Slash commands with mouse and keyboard selection, plus drag-to-reorder blocks.
- Databases with typed properties, configurable options, table, board and list views.
- Per-view filters, sorting and board grouping, with rows that open as editable pages.
- Quick find for pages, databases and rows, plus persistent light and dark themes.

All workspace data stays in the browser that runs the app. There are no accounts, trackers or
external data services required for the core experience.

## Build and test

```bash
npm test
npm run lint
```

The project uses the Sites-compatible Vinext/Cloudflare worker build. `.openai/hosting.json`
contains the Sites project binding so the same source can be published as a private self-hosted
workspace.

The client is split into focused editor, navigation, search, database, dashboard and domain-model
modules under `app/personal-space/`. The test command builds the production worker, smoke-tests its
rendered HTML, and enforces at least 80% line coverage for the domain model.

See [REQUIREMENTS.md](./REQUIREMENTS.md) for the complete product contract and [AGENTS.md](./AGENTS.md)
for repository conventions. The final hostile-use findings and accepted storage limitation are
recorded in [docs/ADVERSARIAL_REVIEW.md](./docs/ADVERSARIAL_REVIEW.md).
