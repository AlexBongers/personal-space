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
- Optional two-way Google Tasks sync through a dedicated database, with encrypted token storage and all-list synchronization.
- Optional two-way Google Calendar sync through a dedicated database, covering every writable calendar with encrypted shared OAuth storage.

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

## Google Tasks

The Google Tasks integration is optional and is disabled until its runtime configuration is present.
Create a Google Cloud OAuth 2.0 **Web application** client, enable the Google Tasks API and Google Calendar API, and add
these redirect URIs to the client:

```text
http://localhost:3000/api/google-tasks/callback
https://personal-space.a-a-t-bongers.chatgpt.site/api/google-tasks/callback
```

Copy `.env.example` to `.env` for local development. Set `GOOGLE_CLIENT_ID`,
`GOOGLE_CLIENT_SECRET`, and a fresh base64url-encoded 32-byte `GOOGLE_TOKEN_ENCRYPTION_KEY`.
For the hosted Site, set the same values as private Sites runtime secrets; do not commit them.
The integration uses the full Tasks scope because two-way sync must create, edit, organize and
delete tasks. The same OAuth client also requests the full Calendar scope so it can create, edit
and delete events across every writable calendar. Connect or reconnect from either the `Google
Tasks` or `Google Calendar` button and use `Sync now`; the refresh token is encrypted in D1 and
shared by both integrations. Calendar sync covers the last 45 days and the next 12 months to keep
the personal workspace fast and compact. New local tasks without a list are created in the first
Google list returned by Google; new local calendar events without a Calendar ID use the first
writable calendar. Calendar entries without a start date stay local until completed.
The Site remains private because the workspace and Google authorization are single-user data.

## News and Gmail inbox

Home and the sidebar include Slashdot and Tweakers. Both feeds use the same four-line summary
layout and a 15-minute refresh interval. Upstream responses are cached per running Worker,
concurrent refreshes are combined, and a failed refresh keeps the last successful headlines.

The optional Gmail panel shows the five latest inbox messages on Home and a paginated inbox
in the sidebar. It uses the existing Google OAuth client and callback above; no extra redirect
URI or runtime secret is needed. Enable **Gmail API** in the same Google Cloud project, then
choose **Gmail koppelen** in the site and approve the additional `gmail.readonly` scope. If the
OAuth app is in testing, the account must be on its test-user list. Tasks and Calendar keep
their existing permissions; the inbox requests no mail-writing or sending permission.

Mail is fetched on opening the inbox and every five minutes while the page is visible. After
loading extra pages, automatic refresh pauses until a manual refresh to preserve your position.
The server requests only envelope headers, snippets, dates and labels, not message bodies or
attachments. Mail previews are not stored in D1 or browser storage; API responses use `no-store`.
Opening a message takes you to the connected account in Gmail. The site must remain owner-only.

See [REQUIREMENTS.md](./REQUIREMENTS.md) for the complete product contract and [AGENTS.md](./AGENTS.md)
for repository conventions. The final hostile-use findings and accepted storage limitation are
recorded in [docs/ADVERSARIAL_REVIEW.md](./docs/ADVERSARIAL_REVIEW.md).
