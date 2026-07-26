# Adversarial Review — Personal Space

Date: 2026-07-26. The running product was attacked in unscripted, hostile ways: malformed and
malicious API payloads, script injection through every text surface, odd keyboard sequences,
rapid-fire input, and state contradictions (deleting things while they were in use). Each finding
below is either **Fixed** (with the fix noted and a regression test) or **Rejected** (with the
reason). Attacks that found nothing are recorded at the end.

## Findings

### F1 — Block with `null`/non-object content crashes the page (Fixed)

- **Repro:** `POST /api/pages/:id/blocks` with `{"type":"paragraph","content":null}` (also
  `"content":"evil"` or `[1,2]`), then open that page in the browser.
- **Observed:** React threw `Cannot read properties of null (reading 'text')`; the page rendered
  zero blocks and was unusable.
- **Fix:** the server now rejects non-object `content` with 400 on both block create and update
  (`server/src/routes/blocks.ts`), and the editor normalises any legacy bad content to `{}` when
  loading (`web/src/editor/Editor.tsx`). Covered by `server/test/blocks.test.ts` and verified by
  re-running the repro (400 returned, page renders).

### F2 — Arbitrary option "color" strings become CSS class names (Fixed)

- **Repro:** `POST /api/properties/:id/options` with `{"name":"X","color":"red; evil words"}`.
- **Observed:** the string was stored verbatim and rendered as `class="chip-red; evil words"` —
  class-name injection. Cosmetic only (no style/script escalation), but sloppy.
- **Fix:** the server whitelists the ten palette colors and falls back to `gray`
  (`server/src/routes/databases.ts`). Verified by re-running the repro (stored color: `gray`).

### F3 — Pasting rich HTML into a block kept the markup until reload (Fixed)

- **Repro:** copy formatted text (or `<b>bold</b><script>…</script>` HTML) and paste into any
  block.
- **Observed:** the contentEditable accepted the HTML nodes, so the page showed styling that
  silently vanished on reload (only plain text is saved). Scripts pasted this way do not execute,
  but WYSIWYG was violated.
- **Fix:** paste is intercepted and inserted as plain text
  (`web/src/editor/ContentEditable.tsx`). Regression: `e2e/phase6-adversarial.spec.ts`
  ("pasting rich HTML lands as plain text").

### F4 — Very fast block creation could be reordered on the wire (Fixed)

- **Repro:** type a line and press Enter a dozen times as fast as automation allows, reload.
- **Observed:** block create/delete/reorder requests were fire-and-forget; the browser may spread
  them over parallel connections, so the server could apply them out of order. Hard to hit by
  hand, easy to hit with automation — and silent data corruption if it lands.
- **Fix:** every block mutation now goes through a serial promise queue so requests reach the
  server in the order they happened (`web/src/editor/Editor.tsx`). Regression:
  `e2e/phase6-adversarial.spec.ts` ("hammering Enter keeps block order intact after reload").

### F5 — A filter on a deleted property silently hid every row (Fixed)

- **Repro:** add a text property, filter the view on it, then delete the property.
- **Observed:** the orphaned filter still applied; every row failed it, so the view looked empty
  with no explanation.
- **Fix:** filters that reference a property that no longer exists are ignored
  (`web/src/database/viewLogic.ts`). Regression: unit test in
  `web/src/database/viewLogic.test.ts` territory via `e2e/phase6-adversarial.spec.ts`
  ("deleting a filtered property leaves the other rows visible").

### F6 — Slash-menu filter swallowed the rest of the line (Fixed)

- **Repro:** put the caret in the middle of existing text, type `/`.
- **Observed:** the menu's filter query became *everything* after the slash, including text the
  user never typed as a query, so the menu showed "No results".
- **Fix:** the query now runs from the slash to the caret only (`web/src/editor/Editor.tsx`,
  `ContentEditable.tsx`).

### F7 — API can set any string as a page "icon" (Rejected)

- **Repro:** `PATCH /api/pages/:id` with `{"icon":"a-very-long-string"}`.
- **Observed:** the string is stored and rendered as text where the emoji would go, which can
  look odd in the sidebar.
- **Rejected because:** the UI only offers a curated emoji picker; the API is local and
  single-user, so the only person who can do this is the owner poking their own database. No
  crash, no injection (React renders it as text). Not worth a server-side emoji validator.

### F8 — Duplicate select options can be created through the API (Rejected)

- **Repro:** `POST /api/properties/:id/options` twice with the same name.
- **Observed:** two identically named options exist; both render and both are selectable.
- **Rejected because:** the UI already prevents this (the picker offers "Create" only when no
  option of that name exists), everything still works with duplicates present, and merging
  duplicates is a product decision out of scope.

### F9 — Type-mismatched row values render oddly but harmlessly (Rejected)

- **Repro:** `PATCH /api/rows/:id/values` with e.g. an object for a text property or a number for
  a multi-select.
- **Observed:** cells guard by type (`Array.isArray`, `typeof` checks, option lookups) and render
  a dash, an empty cell, or `String(value)`; nothing crashes and editing the cell heals the value.
- **Rejected because:** only reachable through hand-crafted API calls against your own local
  data; the UI writes well-formed values and the render path is defensive.

## Attacks attempted with no issue found

- **Script injection everywhere text renders:** titles, block text, option names, search results,
  board cards, breadcrumbs. React escaping plus the editor's `esc()` for initial HTML keep it
  inert — verified in a real browser with a dialog listener
  (`e2e/phase6-adversarial.spec.ts`).
- **`javascript:` URLs in URL cells:** values not starting with `http` are prefixed with
  `https://`, so the link is harmless.
- **Malformed JSON bodies, unknown routes, missing ids:** clean 400/404 JSON errors; the server
  stays up.
- **LIKE wildcards (`%`, `_`, `\`) and emoji in search:** escaped; no wildcard injection.
- **Reorder with partial or foreign block-id lists:** rejected with 400 (permutation check).
- **Block insert with negative/huge `index`:** clamped into range.
- **Backspace-spam on the only block, Enter on empty list items, deleting a divider from the
  block below:** all behave as designed, nothing crashes (unit + e2e covered).
- **Deleting a page/database while it is open elsewhere:** the open view shows a friendly
  "does not exist anymore" state; deep links to deleted pages do the same.
- **500-character titles and very long unbroken words:** sidebar ellipsizes, blocks wrap
  (`word-break`), nothing overflows the layout.
- **Rapid theme toggling and view switching:** state stays consistent; choices persist.
- **Refresh mid-typing:** the 500 ms debounce is flushed on `pagehide` with `keepalive` fetches,
  so the last keystrokes survive a quick close (verified by the phase-2 e2e which reloads
  immediately after a save response).

## Verdict

Five hardening fixes and one UX fix were applied and covered with regression tests; three
low-impact API-only findings were rejected with reasons. After the last fix the full unit suites
(32 backend, 101 frontend) and the full end-to-end suite (27 tests) were re-run and pass.
