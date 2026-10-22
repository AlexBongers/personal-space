# Parro resource identification QA — 2026-10-22

## Live failure observed by orchestrator

Production v58 diagnostics returned HTTP 401, stage message_fetch, code parro_chat_messages_unauthorized for connect/refresh attempts after login, token exchange and prior list operations succeeded. This is a message-fetch failure; it does not establish incorrect credentials.

## Confirmed code defects and regression checks

The nested chatroom/<id>/chatmessage endpoint shape is correct according to the primary client references checked by the orchestrator/backend. The resource helper incorrectly used the first links[].id without considering its relation. Related identity/organisation links can precede self, yielding requests for another resource. It also converted any upstream 403 into an expired-session 401.

Final build plus 131/131 tests passed. Targeted ESLint and git diff --check passed. Controlled fixtures cover related links first and self second, authoritative self over conflicting direct ID, exact /rest/v2/chatroom/23/chatmessage and group=12, successful announcement/chat payloads, related-only ID rejection, genuine 401 rejection, and 403 preserving previous snapshot and connection without token refresh.

DEF-013 remains FIX-READY until a real production refresh produces and saves a fresh snapshot. Existing stale messages must remain available when upstream retrieval fails. No real credentials were submitted in QA, no further browser checks were required for the unchanged UI, and passing mocks do not prove that the user's live upstream resource ordering matches the fixture.

## Live acceptance

The user confirmed “yes het werkt weer” after deployment. The orchestrator independently verified production POST /api/parro/connect HTTP 200 at 2026-10-22T16:32:33.304Z. This route returns success after message retrieval and snapshot storage, establishing actual account synchronization beyond the controlled regression fixtures. DEF-013 is CLOSED. No private message contents were recorded. This acceptance update changes documentation only; the previously passed 131-test runtime remains unchanged.
