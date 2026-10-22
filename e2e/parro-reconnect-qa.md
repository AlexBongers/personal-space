# Parro reconnect QA — 2026-10-22

Scope: rejected reconnect handling, bounded requests and diagnostic reporting. This report does not establish successful live Parro authentication.

## Reproduction

The original outcome helper was imported without editing application code. A simulated failed response with connectionSaved=true, state=sign_in_required and code=credentials_rejected returned connected=true. The server initialized connectionSaved from an existing connection before a new login attempt, so a failed reconnect could appear successful and dismiss its form.

The orchestrator observed two authenticated same-origin production POST /api/parro/connect responses with HTTP 401. The user reported a snapshot more than two hours old and “De Parro-sessie is verlopen. Verbind Parro opnieuw.” These signals support investigation of rejected reconnect handling; they do not identify the precise upstream rejection or prove the user's credentials were accepted.

## Final checks

- Final npm test: build and 128/128 tests passed, zero failures.
- Targeted ESLint across all changed application/worker/test files passed; git diff --check passed.
- Backend tests: rejected reconnect against previous valid and expired connections returns 401 with connectionSaved=false; previous encrypted tokens/messages remain unchanged and lease releases. Expired refresh returns failure rather than a successful saved-connection classification.
- Frontend tests: sign-in rejection takes priority over connectionSaved=true; normal successful connect remains connected; newly saved tokens with only message-fetch failure remain available with a sync warning.
- Whole-body request timeout test verifies TimeoutError and a working retry; connection request deadline is 95 seconds, exceeding the Worker's 90-second deadline, and an unmounted form cancels its request.
- Structured diagnostics are tested to contain operation/stage/code/status/boolean data without username, password, tokens or messages.

## Manual browser check

Opened the real local app at http://localhost:3000/ and navigated from the sidebar to Parro. The disconnected form appeared with username, masked password and optional account inputs enabled. Empty-form submission and disconnected synchronization controls were disabled. Browser console had zero warnings/errors. Screenshot: screenshots/parro-reconnect-form.png.

No credentials were entered or submitted. Browser network interception is not advertised by the available browser tool, so rejected/successful submissions were validated with controlled backend and outcome regressions, not simulated browser network routes. Production publishing and any actual user-account reconnect confirmation remain separate checks for the orchestrator/user.
