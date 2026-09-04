import assert from "node:assert/strict";
import test from "node:test";
import { gmailMessage, handleGmailApi, readGmailInbox } from "../worker/gmail.ts";
import { GMAIL_SCOPE, GOOGLE_SCOPE, handleGoogleTasksApi, type GoogleTasksEnv } from "../worker/google-tasks.ts";

const apiMessage = { id: "message-1", threadId: "thread-1", snippet: "A &amp; B", internalDate: "1788523200000", labelIds: ["INBOX", "UNREAD"], payload: { headers: [{ name: "Subject", value: "An update" }, { name: "FROM", value: "Sender <sender@example.test>" }], body: { data: "never expose" } } };
const env: GoogleTasksEnv = {
  GOOGLE_CLIENT_ID: "test-client", GOOGLE_CLIENT_SECRET: "test-secret", GOOGLE_TOKEN_ENCRYPTION_KEY: "test-key",
  DB: { prepare: () => { throw new Error("Unexpected database access"); }, batch: async () => { throw new Error("Unexpected database write"); } },
};
const oauth = (path: string, headers?: HeadersInit) => {
  const request = new Request(`https://personal.test/api/google-tasks/${path}`, { headers });
  return handleGoogleTasksApi(request, env, new URL(request.url));
};

test("Gmail previews contain only display fields and link to the correct account", () => {
  const message = gmailMessage(apiMessage, "owner@example.test");
  assert.equal(message.subject, "An update");
  assert.equal(message.sender, "Sender <sender@example.test>");
  assert.equal(message.snippet, "A & B");
  assert.equal(message.unread, true);
  assert.equal(message.url, "https://mail.google.com/mail/?authuser=owner%40example.test#inbox/thread-1");
  assert.ok(!JSON.stringify(message).includes("never expose"));
  assert.equal(gmailMessage({ id: "2", threadId: "2", internalDate: "invalid" }, "").receivedAt, "");
});

test("hosted Gmail requires an authenticated site visitor and never accepts writes", async () => {
  const response = await handleGmailApi(new Request("https://personal.test/api/gmail/inbox"), env);
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal((await response.json()).state, "sign_in_required");
  assert.equal((await handleGmailApi(new Request("https://personal.test/api/gmail/inbox", { method: "POST" }), env)).status, 405);
  assert.equal((await (await handleGmailApi(new Request("http://localhost/api/gmail/inbox"), {})).json()).state, "unconfigured");
});

test("Gmail reads only INBOX, uses bounded requests and handles deleted messages", async (t) => {
  let active = 0;
  let maxActive = 0;
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    assert.equal(init?.method || "GET", "GET");
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer test-token");
    const url = new URL(String(input));
    if (url.pathname.endsWith("/profile")) return Response.json({ emailAddress: "owner@example.test" });
    if (url.pathname.endsWith("/labels/INBOX")) return Response.json({ messagesTotal: 80, messagesUnread: 3 });
    if (url.pathname.endsWith("/messages")) {
      assert.equal(url.searchParams.get("labelIds"), "INBOX");
      assert.equal(url.searchParams.get("pageToken"), "next/incoming");
      assert.equal(url.searchParams.get("maxResults"), "20");
      return Response.json({ messages: Array.from({ length: 7 }, (_, id) => ({ id: String(id) })), nextPageToken: "next-outgoing" });
    }
    active++;
    maxActive = Math.max(maxActive, active);
    await new Promise((resolve) => setTimeout(resolve, 2));
    active--;
    assert.equal(url.searchParams.get("format"), "full");
    assert.equal(url.searchParams.get("fields"), "id,threadId,labelIds,snippet,internalDate,payload(headers)");
    if (url.pathname.endsWith("/messages/2")) return Response.json({ error: { message: "Not found" } }, { status: 404 });
    return Response.json({ ...apiMessage, id: url.pathname.split("/").at(-1) });
  });
  const result = await readGmailInbox("test-token", 20, "next/incoming");
  assert.equal(result.state, "connected");
  assert.equal(result.messages.length, 6);
  assert.equal(result.unread, 3);
  assert.equal(result.nextPageToken, "next-outgoing");
  assert.equal(maxActive, 4);
});

test("Gmail distinguishes missing permission, disabled API and expired authorization", async (t) => {
  for (const [status, reason, state] of [[403, "insufficientPermissions", "permission_required"], [403, "SERVICE_DISABLED", "api_disabled"], [401, "authError", "connect"], [429, "rateLimitExceeded", "unavailable"]] as const) {
    const mock = t.mock.method(globalThis, "fetch", async () => Response.json({ error: { details: [{ reason }] } }, { status }));
    await assert.rejects(readGmailInbox("token", 5), (error: unknown) => error instanceof Error && "state" in error && error.state === state);
    mock.mock.restore();
  }
});

test("Gmail OAuth adds read-only access only when explicitly connecting the inbox", async () => {
  const gmail = await oauth("connect?return=gmail");
  assert.equal(gmail?.status, 302);
  const params = new URL(gmail!.headers.get("Location")!).searchParams;
  assert.equal(params.get("scope"), `${GOOGLE_SCOPE} ${GMAIL_SCOPE}`);
  assert.equal(params.get("include_granted_scopes"), "true");
  assert.equal(params.get("redirect_uri"), "https://personal.test/api/google-tasks/callback");
  assert.match(gmail!.headers.get("Set-Cookie")!, /HttpOnly; Secure; SameSite=Lax/);
  const tasks = await oauth("connect");
  assert.equal(new URL(tasks!.headers.get("Location")!).searchParams.get("scope"), GOOGLE_SCOPE);
});

test("Gmail OAuth rejects invalid state and cancellation without touching existing tokens", async () => {
  assert.equal((await oauth("callback?state=wrong&code=code"))?.status, 400);
  const cancelled = await oauth("callback?state=valid&error=access_denied", { Cookie: "personal_space_google_tasks_state=valid; personal_space_google_return=gmail" });
  assert.equal(cancelled?.headers.get("Location"), "/?google=error&service=gmail");
  assert.match(cancelled!.headers.get("Set-Cookie")!, /Max-Age=0/);
});

test("declining the Gmail scope preserves the existing Tasks and Calendar token", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ refresh_token: "replacement-token", scope: GOOGLE_SCOPE }));
  const response = await oauth("callback?state=valid&code=code", { Cookie: "personal_space_google_tasks_state=valid; personal_space_google_return=gmail" });
  assert.equal(response?.status, 303);
  assert.equal(response?.headers.get("Location"), "/?google=error&service=gmail");
});
