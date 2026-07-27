# Adversarial review

The finished product was used in unscripted, hostile ways in a real browser and against the raw
HTTP API: bad input, odd sequences, edge cases. Every finding below is either **fixed** or
**rejected with a reason**. After the last fix, the full unit and end-to-end suites were rerun and
pass.

Method: Chrome driving the running app at http://localhost:8200, plus direct `curl` against the
API to send payloads the UI can never produce.

---

## Fixed

### F1 — The row property panel stayed on screen after leaving a row page

**Severity:** high — wrong data shown on an unrelated page.

**Reproduce**

1. Open **Life › Reading List**, switch to the table view.
2. Click **Open** on any row. The property panel (Author, Shelf, Genre…) appears.
3. Click any ordinary page in the sidebar, for example **Notes › Ideas**.
4. The page title, breadcrumb and blocks are Ideas', but the row's property panel is still there.

**Root cause.** In `PageView`, `RowProperties` and `BlockEditor`/`DatabaseView` were siblings that
both used `key={page.id}`. Two siblings sharing a key is invalid in React, and the reconciler could
not remove the panel cleanly. Confirmed by reading React's fiber: application state held
`row: null` while the DOM still contained the panel.

**Fix.** Distinct keys (`props-<id>`, `blocks-<id>`, `db-<id>`) in `client/src/components/PageView.tsx`.
Locked in by the e2e test *"the row property panel goes away when an ordinary page is opened"*.

### F2 — A long page title made the whole page scroll sideways

**Severity:** medium — layout break.

**Reproduce**

1. Create a page and give it a 400-character title with no spaces.
2. Open it. The content area gains a horizontal scrollbar; the breadcrumb runs off the right edge.

**Root cause.** `.crumb--current` in the breadcrumb had no wrapping or truncation, so one
unbreakable word set the width of the whole column (measured 4474px inside a 2725px area).

**Fix.** Breadcrumb items truncate with an ellipsis and the bar clips (`client/src/styles.css`).
Re-measured afterwards: content width equals the container width, no overflow. The page title
itself already wrapped correctly, as does long block text.

### F3 — Non-string titles and block text were stored as non-strings

**Severity:** medium — corrupt data, and a latent crash.

**Reproduce**

    curl -X POST localhost:8200/api/pages -H 'content-type: application/json' -d '{"title":123}'

The API stored and returned `"title": 123` — a JSON number where every consumer expects a string.
Sorting a database by Name calls `title.toLowerCase()`, which throws on a number.

**Fix.** `asText()` at the repository boundary coerces titles, icons, row titles and block text
(`server/src/repo/pages.ts`, `rows.ts`, `blocks.ts`), with unit tests covering it.

### F4 — Emptying a title left a blank, unclickable-looking row in the sidebar

**Severity:** low — usability.

**Reproduce**

1. Open a page, select the whole title and delete it.
2. The sidebar row for that page becomes empty: no label at all.

**Fix.** A shared `displayTitle()` falls back to "Untitled" in the sidebar tree, breadcrumb,
search results, board cards and list rows; the table's title cell shows an "Untitled" placeholder
(`client/src/db.ts` and callers).

### F5 — Popovers covered the thing they belonged to, near the bottom of the window

**Severity:** medium — the slash menu hid the line you were typing into.

**Reproduce**

1. Open a page whose last block sits low in the window.
2. Put the caret at the end of it, press Enter, and type `/`.
3. The block picker is 337px tall and does not fit below, so it was clamped upward and drawn
   over the block being typed into.

**Root cause.** `Popover` only clamped the panel into the viewport; it had no notion of flipping to
the other side of its anchor.

**Fix.** Anchors now carry a `flipY`, and `anchorBelow()` builds one from any rectangle. When the
panel does not fit below it opens above instead. Every popover in the app — the slash menu, the
block menu, select cells, column and row menus, filter/sort/group, the emoji picker — goes through
the helper. Measured afterwards: the panel sits 6px clear of the block, fully on screen. Asserted
in the e2e suite.

### F6 — Opening the slash menu scrolled the page behind it

**Severity:** low — content jumped by ~15px as the menu appeared.

**Reproduce.** Type `/` in a block low on a page: the page content shifts underneath the menu.

**Root cause.** `SlashMenu` called `element.scrollIntoView()` to keep the highlighted entry
visible. That walks up the DOM and scrolls every scrollable ancestor, including the page itself.

**Fix.** The menu now adjusts its own list's `scrollTop` and touches nothing else
(`client/src/components/SlashMenu.tsx`).

### F7 — The data file did not contain all the data after an abrupt stop

**Severity:** low — a backup footgun, not data loss.

**Reproduce**

1. Use the app, then kill the process.
2. `data/personal-space.sqlite` is 4 KB while `data/personal-space.sqlite-wal` is ~490 KB.
   Copying only the `.sqlite` file would appear to lose everything.

No data is actually lost — SQLite replays the write-ahead log on the next open, which was verified
by restarting the app and confirming all 18 pages and every edit survived.

**Fix.** The server closes the database on `SIGINT`/`SIGTERM`, which checkpoints the log, and the
README now points at the `data/` folder rather than the single file.

---

## Rejected

### R1 — The raw API accepts nonsense date strings

`PATCH /api/rows/:id` with `{"values":{"<date prop>":"2026-13-45"}}` stores the string as given.

**Rejected.** Dates are entered through a native date picker, which cannot produce an invalid
value, and `formatDate()` already falls back to showing the raw string rather than "Invalid Date".
Adding a validation layer for input the UI cannot generate is defensive code with no user benefit.

### R2 — The raw API coerces `true` to `1` in a number property

**Rejected.** Same reasoning: `<input type="number">` cannot send a boolean. The coercion is
well-defined (`Number(true) === 1`) and non-numeric junk such as `"abc"`, `1e400` and `[1,2]`
already becomes `null` rather than corrupting the cell.

### R3 — Clicking "New page" three times quickly creates three pages

**Rejected.** That is what was asked for. Each click is a deliberate action with a visible result,
and each page is one click to delete.

### R4 — Two browser tabs do not see each other's edits until refreshed

**Rejected.** Explicitly out of scope: the requirements state single user, local only, with no
collaboration. Each tab is consistent with the server on load and after any refresh.

### R5 — dnd-kit swallows clicks for 50 ms after a drop

Found while writing the board test: an automated click fired within 50 ms of releasing a card does
nothing.

**Rejected.** This is deliberate behaviour in the drag-and-drop library — it stops the click that
ends a drag from also activating whatever is underneath. 50 ms is far below human reaction time;
only a machine can click that fast. The e2e test waits past the guard, with a comment.

---

## Attacks that found nothing

Recorded because a clean result is also evidence.

| Attack | Result |
| --- | --- |
| `<img src=x onerror=…>` and `<script>` in page titles and block text | Rendered as literal text. Zero injected nodes, `document.title` untouched. |
| `'; DROP TABLE pages; --` as a title | Stored and searched as text; every page still present. Queries are parameterised throughout. |
| `%`, `_`, `\` in the search box | Treated literally; `escapeLike()` covers the SQLite LIKE wildcards. |
| 3 MB request body | Rejected with 400 by the body limit. |
| Malformed JSON, unknown block type, unknown property type | 400, with the server still healthy. |
| Reusing an existing block id | 400 on the second attempt; the first block is untouched. |
| Creating a row on a page that is not a database | 400. |
| Deleting the page you are currently viewing | Falls back to the first page in the tree. |
| Deleting a page twice, deleting an unknown id | 200 then 404. |
| `#/p/does-not-exist`, `#/p/`, `#nonsense` | "Nothing selected" empty state, no console errors. |
| Deleting the property a board groups by | Grouping clears; the board explains how to regroup. |
| Deleting every property in a database | Table keeps Name and all rows, list still works, board asks for a grouping property. |
| Deleting a property used by a filter and a sort | Both are dropped from the view; rows reappear. |
| Backspacing every block out of a page | Page empties to the "Click here and start writing…" target and recovers. |
| Slash menu query matching nothing, then Enter | Shows "No blocks match" and Enter does nothing. |
| A select option named only spaces | Not created. |
| An option whose name differs only by case | Reuses the existing option instead of duplicating. |
| Number cell fed letters, or 320 digits | Cleared to empty rather than storing garbage. |
| 12 checkbox toggles as fast as possible | UI and server agree afterwards; writes are serialised through one queue. |
| 1200-character unbroken word in a paragraph and a code block | Wraps; no horizontal overflow. |
| Full restart after heavy destructive edits | All 18 pages, 9 rows and every edit intact. |
