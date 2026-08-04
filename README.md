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

- Nested pages with emoji icons, rename, cascade delete and automatic D1 saves.
- Paragraphs, headings, lists, to-dos, quotes, dividers, code and callouts.
- Slash commands with mouse and keyboard selection, plus drag-to-reorder blocks.
- Databases with typed properties, configurable options, table, board and list views.
- Per-view filters, sorting and board grouping, with rows that open as editable pages.
- Quick find for pages, databases and rows, persistent light and dark themes, and an English / Dutch interface switch.

Workspace content is stored in the private Cloudflare D1 database provisioned by Sites. Changes
therefore survive browser-storage clearing and are available anywhere the owner opens the private
site. Browser storage is used only for the theme and language preferences, plus a temporary
recovery backup if the database cannot be reached.

## Build and test

```bash
npm test
npm run lint
```

The project uses the Sites-compatible Vinext/Cloudflare worker build. `.openai/hosting.json`
contains the Sites project and logical D1 bindings so the same source can be published as a private
self-hosted workspace. Sites provisions the physical database and applies the migration in
`drizzle/` during deployment.

The client is split into focused editor, navigation, search, database, dashboard and domain-model
modules under `app/personal-space/`. The test command builds the production worker, smoke-tests its
rendered HTML, and enforces at least 80% line coverage for the domain model.

See [REQUIREMENTS.md](./REQUIREMENTS.md) for the complete product contract and [AGENTS.md](./AGENTS.md)
for repository conventions. The final hostile-use findings and accepted storage limitation are
recorded in [docs/ADVERSARIAL_REVIEW.md](./docs/ADVERSARIAL_REVIEW.md).
