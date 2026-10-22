# Compact interface and loading QA — 2026-10-22

Manual browser checks used the real local app at http://localhost:3000/ in Brave through the browser connector. No new browser packages were installed. These are manual results, not an automated E2E suite.

- Opened all four news sources; Slashdot, Tweakers, NOS and Bunniks Nieuws rendered ten articles each.
- Refreshed Tweakers manually; ten articles remained visible, no unavailable warning appeared, refresh control became enabled again.
- Desktop CSS viewport: 1374 by 692. Header measured 56.7 px, compared with the earlier 64 px baseline. No horizontal document overflow.
- Mobile CSS viewport: 354 by 767 (390 by 844 browser override under the existing browser zoom). Header measured 56 px. Document width equalled viewport width, with no horizontal overflow. Opened and closed navigation, navigated to Bunniks Nieuws, and verified ten stories.
- Visually inspected Home on desktop and mobile, mobile feed, and dark mobile feed. Controls remained readable and usable.
- Fresh final desktop tab recorded no browser console warnings or errors. An earlier development hot-module update temporarily mixed language context modules; a full reload recovered and the fresh final tab had no recurrence.
- Screenshots: screenshots/compact-desktop.png, screenshots/compact-mobile.png, screenshots/compact-mobile-dark-feed.png.

Final npm test: 122 passed, zero failed. npm run lint and git diff --check passed. Coverage command reports model.ts 98.85% lines and workspace-store.ts 100% lines; it does not measure every frontend/backend module. Initial page chunk is 42,521 bytes; GmailInbox, ParroInbox and SlashdotFeed are separate dynamic chunks.

Failure handling was checked through controlled regression tests: body-read timeout, retry after timeout, caller cancellation, manual feed refresh bypass, failed response no-store, short stale retry, persisted Parro sign-in requirement and preservation of cached messages. Live private Parro/Gmail credentials were not used to manufacture errors. The live Site requires ChatGPT authentication in this QA browser, so production verification remains the publishing orchestrator's responsibility.

## Post-deployment follow-up

The first v55 live checks returned all four feeds HTTP 200, but a later Tweakers request returned 503 immediately after a successful response. DEF-011 records this Worker-instance fallback gap. The backend now stores best-effort shared public RSS snapshots within one edge location (POP), with 24-hour expiry. A final build and 124/124 tests passed, including replacement-instance snapshot recovery, stale HTTP 200/no-store fallback and cache-service outage tolerance. Live verification after republication remains with the orchestrator. The authenticated bypass API probe cannot establish the user's actual Parro session identity; no production Parro sync success is asserted from that probe.

The v56 production repeat check still returned Tweakers 200, 200, then 503. DEF-011 was reopened because passing controlled Cache API tests did not establish reliable fallback on this host. The next fix must persist successful public snapshots in D1; closure requires both controlled D1 regression and the orchestrator's production repeat check.

## D1 fallback retest

The final implementation replaces the edge cache with source-specific public snapshot rows in D1. Final build plus 124/124 tests passed, including an awaited successful snapshot write, new module instance recovery with no Cache API, stale HTTP 200/no-store after upstream failure, independent sources, and successful live feed responses during D1 failure. Targeted ESLint and git diff --check passed. DEF-011 remains FIX-READY until the orchestrator's production repeat check. The earlier edge-cache statements document the superseded attempt and do not describe the final implementation.

## Production v57 acceptance

The orchestrator's authenticated production verification on 2026-10-22 confirmed all four feeds initially returned HTTP 200 with fifteen fresh stories. Subsequent Tweakers requests returned HTTP 200 with fifteen fresh stories at 16:12:21.658Z and 16:12:22.989Z, then HTTP 200 with fifteen stories and stale=true, preserving the 16:12:22.989Z snapshot after a real upstream failure. This is live evidence of successful D1 fallback, replacing the 503 responses observed on v55/v56. DEF-011 is CLOSED. No production Parro login or successful private-account synchronization is claimed; its recovery behavior was validated through controlled tests.
