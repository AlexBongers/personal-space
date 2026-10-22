## DEF-013: Parro chat preview request aborts an otherwise authenticated synchronization

- Status: CLOSED
- Severity: HIGH
- Found by: qa
- Phase: 2

Steps to reproduce:
1. Start the deployed Personal Space Site with a Parro account containing unread chatrooms.
2. Connect or refresh Parro.
3. Allow login/token exchange, group and chatroom listing, and announcement retrieval to complete.
4. Observe the subsequent chat-message request and overall synchronization result.

Expected: The authenticated chat-message request uses the actual Parro endpoint and completes synchronization, retaining existing messages if any required upstream operation fails.
Actual: Production v58 diagnostics consistently return HTTP 401 at stage message_fetch with code parro_chat_messages_unauthorized after login/token exchange and prior listing calls succeed. Current code requests /chatroom/<id>/chatmessage for unread previews; this failure aborts the entire snapshot and is shown as an expired session, even though the earlier login succeeded. The nested endpoint shape is correct according to the primary client references; resource identification incorrectly chooses the first related link rather than the self relation, and upstream HTTP 403 is incorrectly converted into expired-session HTTP 401.

History:
- orchestrator: backend-dev corrected resource identifiers to use the authoritative self relation, retained the documented nested chat endpoint, and distinguished permission denial from expired authentication; seventeen targeted tests pass, awaiting QA and live retrieval.
- qa: opened from the orchestrator's new sanitized v58 production diagnostics. This identifies a message-fetch protocol failure separately from DEF-012's reconnect outcome classification. QA has not submitted credentials or asserted successful end-to-end live synchronization.
- qa: controlled protocol retest passed with final build and 131/131 tests, targeted ESLint and diff check. Related organisation/identity links listed before self no longer redirect requests to the wrong resource, self wins over a conflicting direct ID, and related-only identifiers fail safely. The test checks exact /rest/v2/chatroom/23/chatmessage and group=12. Genuine upstream 401 still requires sign-in; upstream 403 preserves valid tokens and the prior snapshot without attempting token refresh. Status remains FIX-READY pending actual production refresh and a fresh saved snapshot; no real-account synchronization success is asserted.
- qa: closed after the user confirmed “yes het werkt weer” and the orchestrator verified production POST /api/parro/connect HTTP 200 at 2026-10-22T16:32:33.304Z. The route returns 200 only after successful message retrieval and snapshot storage, confirming the real-account synchronization path after deployment. No private message contents were inspected or recorded.


## DEF-012: Rejected Parro reconnect is reported as a successful connection

- Status: CLOSED
- Severity: MEDIUM
- Found by: qa
- Phase: 2

Steps to reproduce:
1. Start Personal Space with an existing saved Parro connection.
2. Open Parro and choose to reconnect.
3. Submit credentials that the upstream login rejects with HTTP 401.
4. Observe the failed reconnect response and connection form outcome.

Expected: The new login attempt fails visibly and the reconnect form remains available, while the previous saved messages and connection record are preserved.
Actual: The server sets connectionSaved from the existence of the old connection before attempting login. On rejection it returns connectionSaved=true; the frontend outcome helper interprets that as connected=true and closes the form despite authentication failure.

History:
- qa: opened after reproducing the original helper with a mocked HTTP failure payload containing connectionSaved=true, state=sign_in_required and code=credentials_rejected; it returned connected=true. Production POST /api/parro/connect returned HTTP 401 twice with an authenticated site user and same-origin requests, but the user's exact upstream error is not yet established. No real credentials were used in QA.
- orchestrator: backend now reports only newly saved valid connections; frontend keeps rejected authentication visible, preserves messages, and bounds connect and refresh requests beyond the server deadline. Targeted tests pass; awaiting QA.
- qa: closed the rejected-reconnect classification defect after final build and 128/128 tests passed. Backend regressions cover old valid and expired connections: rejected new credentials return HTTP 401/connectionSaved=false while old encrypted records and messages remain intact and the lease is released. Frontend regressions prioritize sign_in_required/needsSignIn over old saved tokens, retain failure outcome, and distinguish a newly saved login with message-fetch failure. Timeout regression verifies stalled-body TimeoutError and retry. Local browser form navigation passed with no console warnings/errors; no credentials were submitted, so this does not verify successful upstream account authentication.


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
- qa: reopened after orchestrator production v56 retest: two Tweakers requests returned HTTP 200, followed by HTTP 503. Cache API snapshots did not provide a reliable fallback on this host. Awaiting a D1-backed last-successful public feed and controlled regression plus live repeat verification.
- qa: D1 fix retested with final build and 124/124 tests passed. A successful public feed write completes before response; replacement module instances recover the source-specific D1 snapshot without Cache API, upstream failure returns stale HTTP 200/no-store, and D1 outages still permit successful upstream responses. Status remains FIX-READY pending the orchestrator's post-deployment production repeat check.
- qa: closed after orchestrator production v57 verification on 2026-10-22. All four sources returned HTTP 200 with fifteen fresh stories. Tweakers then returned HTTP 200/fifteen stories with fetchedAt 16:12:21.658Z, followed by HTTP 200/fifteen fresh stories at 16:12:22.989Z, then HTTP 200/fifteen stories with stale=true and the same 16:12:22.989Z snapshot after an actual upstream failure. This confirms the production D1 fallback preserved articles where v55/v56 returned HTTP 503.


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
