## DEF-011: News fallback disappears across Worker instances

- Status: CLOSED
- Severity: MEDIUM
- Found by: qa
- Phase: 2

Steps to reproduce:
1. Open the deployed Personal Space Site and request Tweakers news successfully.
2. Request the same feed again through a different Worker instance while upstream is temporarily unavailable.
3. Observe the second response despite the successful response moments earlier.

Expected: A last successful public feed remains available across Worker instances and is returned with a stale indicator during temporary upstream failures.
Actual: Production v55 returned Tweakers HTTP 503 about one second after a successful HTTP 200 response containing fifteen articles. The in-memory feed map belongs to one Worker instance, so another instance has no fallback.

History:
- qa: opened from the orchestrator's authenticated post-deployment reproduction; the earlier DEF-009 refresh and browser caching regressions remain passed, while cross-instance fallback needs durable shared storage.
- orchestrator: backend-dev added a shared edge cache of successful public RSS snapshots, awaited before responding, with source isolation and stale fallback; eight targeted RSS tests pass, awaiting QA.
- qa: closed after final build and 124/124 tests passed; independent module instances successfully read the shared public RSS snapshot, failed upstream refresh returned HTTP 200 with stale stories and no-store, sources remained isolated, and cache-storage outages did not block successful live feeds. Deployment must still be checked by the orchestrator; Cache API snapshots are best-effort and expire after 24 hours.


## DEF-010: Expired Parro connection stays connected after navigation

- Status: CLOSED
- Severity: MEDIUM
- Found by: qa
- Phase: 2

Steps to reproduce:
1. Start Personal Space with saved Parro connection tokens and cached messages.
2. Let the upstream refresh token expire and trigger Parro synchronization.
3. Navigate away and return to the Parro page.

Expected: The connection remains marked as requiring sign-in, existing messages are preserved, and a successful reconnect restores normal synchronization.
Actual: Authentication failure was returned only for the current refresh; subsequent status reads still reported the saved connection as connected and repeated refresh attempts used the same invalid tokens.

History:
- qa: opened from backend diagnosis of the saved expired-token state; regression uses mocked upstream authentication failure rather than altering the user's live connection.
- orchestrator: backend implemented persisted needsSignIn flag, preserved cached messages, stopped repeated expired-token requests, and cleared the flag after successful reconnect; ready for QA regression retest.
- qa: closed after final 122-test suite passed, including persisted expired-token sign-in state, no repeated upstream refresh, cached-message preservation, and successful reconnect clearing the sign-in flag; live credentials were not modified.


## DEF-009: Feed refresh cannot recover promptly after a load failure

- Status: CLOSED
- Severity: MEDIUM
- Found by: qa
- Phase: 2

Steps to reproduce:
1. Start Personal Space and open a news source from the sidebar.
2. Allow the first request to succeed, then simulate an upstream failure after the cached feed expires.
3. Restore the upstream feed and activate the source's refresh control within fifteen minutes.
4. Separately, request a source with no successful cached response while upstream is unavailable and inspect its response cache policy.

Expected: Manual refresh requests fresh upstream data; temporary failures are not browser-cached and automatic recovery retries promptly while preserving previously loaded stories.
Actual: The Worker ignores manual reload intent, backs stale failures off for fifteen minutes, and returns HTTP 503 with private max-age=900. A retry can therefore retain a failure or stale result for fifteen minutes.

History:
- qa: opened after inspecting the production-equivalent Worker flow and establishing feed-loading checks; current upstream sources all render locally, while failure and refresh cases require controlled regression tests.
- orchestrator: backend-dev implemented explicit refresh cache bypass, no-store failure responses, and a thirty-second stale retry interval; targeted regression tests pass, awaiting QA retest.
- qa: closed after final build and all 122 tests passed, including no-store failure policy, coalesced manual cache bypass, short stale backoff and retry regressions; local Tweakers refresh completed with ten visible articles and an enabled refresh control.


## DEF-008: Tweakers feed fails to load on the live Site

- Status: CLOSED
- Severity: MEDIUM
- Found by: qa
- Phase: 2

Steps to reproduce:
1. Start Personal Space and open the live Site.
2. Select `Tweakers` from the sidebar to open its news page.
3. Wait for the feed request to finish.

Expected: The Tweakers page displays recent article headlines and summaries, or the last successful feed with a stale-data notice if a refresh fails.
Actual: The live `GET /api/tweakers` returned HTTP 503 at 2026-09-23 14:45 UTC and again at 14:52 UTC. When there is no cached successful feed, the page displays its unavailable-feed message instead of articles.

History:
- qa: opened after reproducing HTTP 503 responses from the live feed endpoint; awaiting a deployed fix before retest.
- orchestrator: recorded backend-dev's switch to Tweakers' direct news feed; targeted tests pass, awaiting live retest.
- qa: closed after production retest of the deployed fix; manual refresh updated the page at 17:03 local time, the UI rendered 10 Tweakers headlines without an unavailable/stale error, and the post-deploy production `GET /api/tweakers` log was HTTP 200.

## DEF-007: Disconnected Parro is shown as an empty connected inbox

- Status: CLOSED
- Severity: LOW
- Found by: qa
- Phase: 2

Steps to reproduce:
1. Start the app with Parro direct sync configured but without a saved Parro connection.
2. Open Home and select Parro to open the full Parro page.
3. Observe the connection form and activate `Parro nu synchroniseren` without entering credentials.

Expected: The disconnected state shows a clear connection prompt; inbox-only controls and the empty-inbox message are hidden or disabled until Parro is connected.
Actual: The page shows the connection form together with `Nog geen Parro-berichten`, and the sync button remains enabled but only reloads the same disconnected state without visible feedback.

History:
- qa: opened
- qa: closed after browser retest; disconnected Home and full-page panels now show the connection prompt without an empty-inbox message, and the sync control is disabled with connection guidance.

## DEF-006: Corrupt news preference order is accepted with duplicate feeds

- Status: CLOSED
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
- qa: closed after focused retest; unknown versions fall back to the four default sources and duplicate valid sources are reduced to one before missing sources are appended.

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
