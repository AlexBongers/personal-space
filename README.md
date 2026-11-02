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
- Tasks and appointments are added and edited in a compact editor: nothing is created until you save, deadlines
  have shortcuts (today, tomorrow, next week), and new appointments start at the next whole hour for one hour.
  Every task list has a quick-add line. Drag a task to another list (also moved in Google Tasks; a list chosen
  in the app that Google does not have yet is created there) or an appointment to another day. Tasks with
  subtasks and repeating appointments stay put, because moving them would affect their subtasks or series.

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
optimization, and `workers_dev: true` (the workers.dev address, protected by Cloudflare Access).

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

## macOS app (local, Apple Silicon)

Personal Space also runs as a standalone macOS app. The app is an Electron shell around the same
Worker build: a local server on `127.0.0.1:3210` serves the client assets and hands every other
request to the Worker, with a SQLite file instead of Cloudflare D1. No Cloudflare account or
Access login is involved, and `app/` and `worker/` are unchanged, so the Cloudflare deployment keeps
working.

Build on your Mac (Node 22.13 or newer):

```bash
npm install
npm run desktop:build
```

This produces `release/mac-arm64/Personal Space.app`; drag it to `/Applications`. Use
`npm run desktop:dmg` for a disk image and `npm run desktop:dev` to run it without packaging.
The app is not notarized, which is fine for a build made on your own Mac. If you copy a build
from somewhere else, clear the quarantine flag once:

```bash
xattr -dr com.apple.quarantine "/Applications/Personal Space.app"
```

`npm run local` runs the same server without Electron (data in `.local-data/`, configuration from
the environment variables in `.env.example`), which is handy for development.

Everything lives in `~/Library/Application Support/personal-space/` (menu **Bestand > Open datamap**):

- `personal-space.sqlite`: the workspace plus the Google and Parro connections.
- `config.json`: your Google OAuth client (`googleClientId`, `googleClientSecret`) and the optional
  `googleCalendarSyncOnly` calendar name. Restart the app after editing it.
- `keys.bin`: the token encryption keys, created on first start and encrypted with the macOS Keychain.
- `backups/`: a copy of the database once per day, the latest 14 are kept.

### Desktop features

The macOS app adds what a browser tab cannot do. Closing the window keeps the app running in the
menu bar; `Cmd+Q` or **Stop** in the menu bar quits it.

| Shortcut, works in every app | What it does |
|---|---|
| `Cmd+Option+N` | Quick note: appends a timestamped note to the page "Snelle notities". `Cmd+Enter` saves. |
| `Cmd+Option+R` | Reminders: type "morgen 9:00 tandarts bellen" or fill in a date and time. |
| `Cmd+Option+K` | Search all pages, notes and database rows, including their content. Enter opens the result. |
| `Cmd+Option+P` | Bring Personal Space to the front. |
| `Cmd+,` | Open `config.json`. |

**Notifications.** Everything below arrives as a real macOS notification; clicking one opens the
matching page, calendar event, task or e-mail.

- Reminders, once or repeating daily or weekly. With "Pop-up die blijft staan" a dialog also stays on
  screen until you press Klaar or postpone it by 10 minutes or an hour. A reminder that came due while
  the app was closed fires at the next start.
- Reminders understand Dutch: "over 20 min thee", "om 16:00 boodschappen", "vrijdag 14:30 rapport",
  "overmorgen ophalen", "vanavond vuilnis buiten", "12-7 verjaardag Sanne", "3 maart 2027 10:00 APK".
  A day without a time means 09:00; "vanavond" means 20:00.
- A daily overview at 07:30 with today's events, due tasks and reminders. When the Mac is opened later,
  it comes at the first moment after that.
- A notification 10 minutes before each calendar event.
- New Parro messages (sender, title, group) and new Gmail messages (sender, subject). Each message is
  announced once, also across restarts; existing messages are not announced when you first connect.
  The Dock badge shows the number of unread Parro messages.

The first notification makes macOS ask for permission. Use **Bestand > Stuur test-melding** to check;
if nothing shows, enable Personal Space under System Settings > Notifications. Focus modes silence
notifications but not pop-ups.

**Menu bar.** The icon lists today's calendar events, due and overdue tasks and the next reminders,
with the number of due tasks next to it. Clicking an event or task opens it.

**Background sync.** Every 5 minutes Parro is refreshed and Gmail is checked. Every 15 minutes Google
Tasks and Calendar are synced while no window is open; with the window open the page syncs itself.
Changes made outside the window, such as a quick note, a background sync or a link, are merged into
the open window without a reload, so nothing you are typing is lost.

**Links for Shortcuts, Siri and Raycast.** The app registers `personal-space://`:

```text
personal-space://note?text=Melk%20kopen
personal-space://reminder?text=morgen%209:00%20tandarts%20bellen
personal-space://reminder?text=Tandarts&at=2026-06-11T09:00:00%2B02:00
personal-space://search?q=japan
personal-space://open?id=<page id>
```

In the Shortcuts app, use the **Open URL** action with one of these and give the shortcut a name such
as "Notitie in Personal Space" to use it with Siri.

**Files.**

- **Bestand > Exporteer als Markdown...** writes pages as nested folders and database rows as files
  with their properties, skipping the trash. **Importeer Markdown-map...** reads such a folder (or an
  Obsidian vault) back in under a new "Import" page.
- **Bestand > Exporteer als PDF...** prints the open page.
- **Klembord als notitie** (File menu, menu bar and Dock menu) saves the copied text as a quick note.
- Right-click offers spelling suggestions, cut, copy and paste, and opening or copying links.

**Backups.** A backup is made every day while the app runs (`backups/`, the latest 14 are kept).
**Maak back-up nu** always makes an extra one. Set `backupDir` to also copy the daily backup to a
folder such as iCloud Drive, so a copy lives outside the Mac. **Back-up terugzetten...** replaces the
database with a chosen backup and keeps the previous one as `before-restore-...`.

**Settings** in `config.json`, all optional:

| Key | Default | Meaning |
|---|---|---|
| `port` | `3210` | Local port. Add the matching Google redirect URI when you change it. |
| `briefingTime` | `"07:30"` | Time of the daily overview; `""` turns it off. |
| `eventReminderMinutes` | `10` | Minutes before a calendar event; `0` turns it off. |
| `notifyParro`, `notifyGmail` | `true` | Notifications for new messages. |
| `backupDir` | `""` | Extra backup folder, for example `/Users/you/Library/Mobile Documents/com~apple~CloudDocs/Personal Space`. |

Restart the app after editing it. `app.log` (**Open logbestand**) records failed syncs and backups.
**Start bij inloggen** in the File menu starts the app in the menu bar when you log in.

The build is ad-hoc signed (`identity: "-"` in `electron-builder.yml`). That needs no Apple account, and
macOS only delivers notifications from signed apps. Every new build has a new signature, so macOS asks
once per build whether Personal Space may use its key in the Keychain: choose **Always Allow**. If the
key cannot be read at all, the app offers to make new keys; your pages stay intact and only Google and
Parro must be connected again. Keep the internal name `personal-space` in `package.json`: the Keychain
key is stored under it.

The app icon is your own little planet: a smiling ringed planet with a moon on a starry night tile
(`desktop/icon.svg`, rendered to `icon.png`, following the macOS icon grid; electron-builder makes every
size from it). The menu bar shows the same ringed planet as `trayTemplate.png`, a black template image
that macOS tints for light and dark menu bars. After editing an SVG, render it to PNG again at
1024 px (`icon.png`) and 18 and 36 px (`trayTemplate.png`, `trayTemplate@2x.png`).

### How the desktop app is built

`desktop/main.ts` only wires things together and handles the app's lifecycle. Each concern has a small
module: `server.ts` (local server and in-process Worker calls), `windows.ts`, `tray.ts`, `menus.ts`,
`notifier.ts`, `commands.ts` (everything a menu item does), `ipc.ts` (the only channels the tool windows
can use), `scheduler.ts` (one timer for reminders, the menu bar, backups and syncs) and the testable logic
in `agenda.ts`, `reminder-service.ts`, `background-sync.ts`, `notifications.ts`, `search.ts`,
`natural-time.ts` and `deep-link.ts`.

It is built to run for weeks:

- A closed window is destroyed, so its renderer process and memory are released. With the window closed the
  app is two processes; Chromium's network service runs inside the main process.
- The menu bar reads one revision number per minute and only parses the workspace when it changed; its
  menu is only rebuilt when its content changes. Reminders live in memory. Background syncs call the
  Worker in process instead of over a socket, read every response to the end, and a pass that hangs is
  abandoned after five minutes.
- Unexpected errors are logged to `app.log` instead of showing crash dialogs, a crashed window reloads,
  the scheduler catches up after the Mac wakes from sleep, a window saved on a disconnected display
  opens on screen, and a port that is taken gives a clear message.

A soak test of 60 tool windows and 300 links left the window and process count unchanged and the main
process heap at about 9 MB.

### Desktop tests

`npm test` covers the desktop modules. `npm run test:desktop` starts the real Electron app with its own
data folder and drives the windows, menus, links and reminders; on Linux without a display run it
under `xvfb-run -a`.

Moving over from the Cloudflare site:

1. Export the workspace there with the `•••` menu.
2. In the app, open **Import workspace** in the `•••` menu and choose the file.
3. Add `http://localhost:3210/api/google-tasks/callback` as a redirect URI to your Google OAuth
   client, fill in `config.json`, and connect Tasks, Calendar and Gmail again. Google sign-in opens
   in your default browser, because Google refuses OAuth in embedded windows.
4. Connect Parro again; tokens are encrypted per installation and cannot be carried over.

Sync stays page-driven, so it only runs while the app is open. After the move the Mac is the
source of truth; there is no sync with the Cloudflare copy.

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
writable calendar. Calendar entries without a start date stay local until completed. On the free Cloudflare plan each sync handles a limited number of changes; when the calendar reports pending changes, press Sync now again until they are gone.
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
