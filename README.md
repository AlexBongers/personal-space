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

Workspace content is stored in a private Cloudflare D1 database bound to the Worker. Changes
therefore survive browser-storage clearing and are available anywhere the owner signs in. Browser
storage is used only for the theme and language preferences, plus a temporary recovery backup if
the database cannot be reached.

## Build and test

```bash
npm test
npm run lint
```

The app is a Vinext build running as a Cloudflare Worker. `wrangler.json` holds the Worker
configuration: the D1 binding `DB` (migrations in `drizzle/`), the Images binding used for image
optimization, and `workers_dev: false`.

The client is split into focused editor, navigation, search, database, dashboard and domain-model
modules under `app/personal-space/`. The test command builds the production worker, smoke-tests its
rendered HTML, and enforces at least 80% line coverage for the domain model.

## Deploy to Cloudflare

The Worker runs on Cloudflare's free plan with a D1 database. Cloudflare Access keeps it private:
the Worker serves nothing unless the request carries the signed-in Access identity, and localhost
development is the only exception.

One-time setup, from the repository root:

```bash
npx wrangler login
npx wrangler d1 create personal-space
```

Copy the `database_id` that Wrangler prints into `wrangler.json`, replacing
`00000000-0000-4000-8000-000000000000`. Then create the tables and store the secrets:

```bash
npm run db:migrate
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put GOOGLE_TOKEN_ENCRYPTION_KEY
npx wrangler secret put PARRO_TOKEN_ENCRYPTION_KEY
```

`PARRO_TOKEN_ENCRYPTION_KEY` is optional; leave it out to reuse the Google key.

Attach your own domain under **Workers & Pages > personal-space > Settings > Domains & Routes**.
In **Cloudflare One (Zero Trust) > Access > Applications**, add a self-hosted application for that
hostname with a policy that allows only your own email address. Do not expose the `workers.dev`
address; it is disabled in `wrangler.json`.

Deploy with:

```bash
npm run deploy
```

Run `npm run db:migrate` again whenever `drizzle/` gets a new migration.

To move your existing workspace, export it from the old site with the `•••` menu, then open
**Import workspace** in the same menu on the new site and choose the file. An import replaces the
whole workspace, after a confirmation.

The owner identity is now your Access email instead of the old Sites user id, so connect Parro and
Google once more on the new domain. To test migrations locally
first, run `npx wrangler d1 migrations apply DB --local`.

## Google Tasks

The Google Tasks integration is optional and is disabled until its runtime configuration is present.
Create a Google Cloud OAuth 2.0 **Web application** client, enable the Google Tasks API and Google Calendar API, and add
these redirect URIs to the client:

```text
http://localhost:3000/api/google-tasks/callback
https://your-domain.example/api/google-tasks/callback
```

Copy `.env.example` to `.env` for local development. Set `GOOGLE_CLIENT_ID`,
`GOOGLE_CLIENT_SECRET`, and a fresh base64url-encoded 32-byte `GOOGLE_TOKEN_ENCRYPTION_KEY`.
For the deployed Worker, set the same values as Cloudflare secrets with `wrangler secret put`; do not commit them.
The integration uses the full Tasks scope because two-way sync must create, edit, organize and
delete tasks. The same OAuth client also requests the full Calendar scope so it can create, edit
and delete events across every writable calendar. Connect or reconnect from either the `Google
Tasks` or `Google Calendar` button and use `Sync now`; the refresh token is encrypted in D1 and
shared by both integrations. Calendar sync covers the last 45 days and the next 12 months to keep
the personal workspace fast and compact. New local tasks without a list are created in the first
Google list returned by Google; new local calendar events without a Calendar ID use the first
writable calendar. Calendar entries without a start date stay local until completed.
The site remains private behind Cloudflare Access because the workspace and Google authorization are single-user data.

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

## Parro school messages

Parro now connects directly from the private site. Open the Parro panel, select
**Verbinden**, and enter your Parro credentials. If the login contains multiple
identities, provide a unique part of the desired person's name or role in Account.
Login follows Parro's PKCE authorization flow, including the account and application
pickers. The password and temporary login cookies are used only during that request.

The Worker fetches announcements and unread chatrooms directly from Parro; no QNAP,
Hermes process or scheduled NAS watcher is required. The panel refreshes on opening,
periodically while visible, and when you choose **Vernieuwen**. This is page-driven
synchronization: it does not run while the page is closed.

Set `PARRO_TOKEN_ENCRYPTION_KEY` to a base64/base64url-encoded 32-byte secret in the
Worker secrets. When omitted, the existing `GOOGLE_TOKEN_ENCRYPTION_KEY` is used with
Parro-specific AES-GCM authenticated context. D1 stores encrypted access/refresh
tokens bound to the owner's Cloudflare Access identity, and the latest sanitized message snapshot.
Never put keys or credentials in frontend code, Git or browser storage. Apply all
D1 migrations before using the connection. Local development uses the local identity;
connect separately on the owner-only deployed site.

`POST /api/parro/connect`, `POST /api/parro/refresh`, and
`DELETE /api/parro/connection` require the signed-in owner's same-origin request.
The server rotates expired tokens automatically and retains the previous snapshot
on failed reads. A shared lease prevents simultaneous refresh/import operations.
Requests share a 90-second upstream deadline. Disconnect removes the saved tokens
and Parro messages. Responses and credentials are never logged.

The old `scripts/parro_watcher.py` and bearer-protected `/api/parro/sync` remain
available for migration only. Once a direct connection exists, legacy imports are
rejected. Remove the old NAS schedule after connecting; its token is not needed for
the direct connection.

The login protocol in `worker/parro-client.ts` is adapted from
[Anne Schuth's parro-cli](https://github.com/anneschuth/parro-cli), distributed under
the MIT license. Its copyright and license are retained in
[`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md).

See [REQUIREMENTS.md](./REQUIREMENTS.md) for the complete product contract and [AGENTS.md](./AGENTS.md)
for repository conventions. The final hostile-use findings and accepted storage limitation are
recorded in [docs/ADVERSARIAL_REVIEW.md](./docs/ADVERSARIAL_REVIEW.md).
