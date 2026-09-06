## DEF-005: Legacy import can replace a pending recovery draft

- Status: CLOSED
- Severity: HIGH
- Found by: qa
- Phase: 1

Steps to reproduce:
1. Leave a valid current-tab recovery draft in local storage and also leave a valid legacy `STORAGE_KEYS.items` record.
2. Start the app while the server is reachable; wait for the current recovery to be loaded and its save to be pending.
3. Click Import in the legacy recovery banner.

Expected: Import is blocked or requires an explicit merge while the current recovery draft is dirty or saving.
Actual: `acceptLegacyRecovery()` checks only backend/editability/conflict state and can replace the current recovery items before that draft is confirmed.

History:
- qa: opened
- qa: closed after retest; import now returns false while a timer, save request or dirty generation is pending, and the scenario is covered by the controller test.

## DEF-004: Recovery drafts from other tabs are not offered to the user

- Status: CLOSED
- Severity: MEDIUM
- Found by: qa
- Phase: 1

Steps to reproduce:
1. Create a valid recovery record using a different tab draft id.
2. Open the app in a new tab with the same local storage.
3. Inspect the loading or workspace UI.

Expected: Each stale draft is listed separately so the user can inspect, recover, or discard it.
Actual: The controller reads the records internally, but the hook does not expose them and the UI provides no recovery choice.

History:
- qa: opened
- qa: closed after retest; the hook exposes the current draft id and the page lists other-tab drafts with Recover and Discard actions.

## DEF-003: Reconnect retry can overlap an in-flight workspace save

- Status: CLOSED
- Severity: MEDIUM
- Found by: qa
- Phase: 1

Steps to reproduce:
1. Start a workspace save with a transport that remains pending.
2. Trigger the browser `online` event or make the document visible again.
3. Observe the retry path while the original save is still pending.

Expected: Retry waits for or reconciles the existing request before loading or sending another request.
Actual: `retry()` calls `load(true)` without waiting for `savePromise`, so a reload can mutate the controller state while the original PUT remains in flight.

History:
- qa: opened
- qa: closed after retest; retry now flushes an existing timer/in-flight save before reloading.

## DEF-002: Google sync does not hold a shared workspace mutation lock

- Status: CLOSED
- Severity: HIGH
- Found by: qa
- Phase: 1

Steps to reproduce:
1. Open a Google Tasks or Google Calendar sync dialog and start a sync request.
2. While the request is running, edit a page or add a Home quick item.
3. Close the dialog before its `onReplace` callback completes.

Expected: Workspace edits are blocked until the sync finishes or its uncertain result is reconciled.
Actual: The dialogs have no shared lock or flush callback; normal editors and Home can continue calling `setItems` while the sync request is active, and closing the dialog does not retain a lock.

History:
- qa: opened
- qa: closed after retest; both Google dialogs acquire the shared mutation lock, flush first, and release only in their request finally block.

## DEF-001: Legacy browser workspace is ignored during D1 startup

- Status: CLOSED
- Severity: HIGH
- Found by: qa
- Phase: 1

Steps to reproduce:
1. Put a valid pre-D1 workspace in `localStorage` under the existing `STORAGE_KEYS.items` key and leave the migration marker unset.
2. Start the app while `/api/workspace` returns the initial D1 workspace.
3. Reload the app and inspect the workspace.

Expected: The legacy workspace is preserved and offered for explicit migration or recovery.
Actual: The new persistence hook never reads the legacy key or migration marker, so the D1 workspace is loaded and the legacy content is ignored.

History:
- qa: opened
- qa: closed after retest; legacy recovery is read, preserved and exposed with explicit Import/D1 behouden actions.
## DEF-006: Corrupt news preference order is accepted with duplicate feeds

- Status: OPEN
- Severity: LOW
- Found by: qa
- Phase: 2

Steps to reproduce:
1. Put `{"version":99,"order":["slashdot","slashdot"],"collapsed":{}}` under the Home news preference key in local storage.
2. Open Home and open the news customization panel.
3. Inspect the rendered feed list and its source order.

Expected: An unknown preference version or duplicate source falls back to the four fixed sources exactly once.
Actual: The reader ignores the version and preserves duplicate valid sources, so duplicate React keys and duplicate feeds can render.

History:
- qa: opened
## DEF-006: Corrupt news preference order is accepted with duplicate feeds

- Status: OPEN
- Severity: LOW
- Found by: qa
- Phase: 2

Steps to reproduce:
1. Put `{"version":99,"order":["slashdot","slashdot"],"collapsed":{}}` under the Home news preference key in local storage.
2. Open Home and open the news customization panel.
3. Inspect the rendered feed list and its source order.

Expected: An unknown preference version or duplicate source falls back to the four fixed sources exactly once.
Actual: The reader ignores the version and preserves duplicate valid sources, so duplicate React keys and duplicate feeds can render.

History:
- qa: opened
