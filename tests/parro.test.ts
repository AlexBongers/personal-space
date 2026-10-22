import assert from "node:assert/strict";
import test from "node:test";
import { handleParroApi, sanitizeParroPayload, type ParroDatabase, type ParroStatement } from "../worker/parro.ts";
import { fetchParroMessages, loginParro, ParroError } from "../worker/parro-client.ts";

const message = {
  id: "announcement:one",
  kind: "announcement",
  title: "School update",
  body: "A short update for parents.",
  sender: "School",
  roomName: "Group 4",
  publishedAt: "2026-09-05T08:00:00Z",
  unread: true,
  unreadCount: 1,
  externalUrl: "https://parro.com/announcement/one",
  attachmentCount: 2,
  attachmentNames: ["weekbrief.pdf", "foto.jpg"],
};

test("Parro payloads are bounded, normalized and limited to safe links", () => {
  const payload = sanitizeParroPayload({ replace: true, syncedAt: "not-a-date", messages: [{ ...message, title: "  A   title  ", externalUrl: "https://evil.test/message" }] }, "2026-09-05T09:00:00.000Z");
  assert.ok(payload);
  assert.equal(payload.replace, true);
  assert.equal(payload.syncedAt, "2026-09-05T09:00:00.000Z");
  assert.equal(payload.messages[0].title, "A title");
  assert.equal(payload.messages[0].externalUrl, "");
  assert.equal(payload.messages[0].attachmentCount, 2);
  assert.deepEqual(payload.messages[0].attachmentNames, ["weekbrief.pdf", "foto.jpg"]);
  assert.equal(sanitizeParroPayload({ messages: [{ ...message, kind: "unknown" }] }), null);
  assert.equal(sanitizeParroPayload({ messages: Array.from({ length: 201 }, () => message) }), null);
});

test("hosted Parro reads require the Site visitor identity", async () => {
  const database: ParroDatabase = {
    prepare: (query) => ({ bind() { return this; }, async all<T>() { return { results: query.includes("workspace_state") ? [] : [{ id: "announcement:one", kind: "announcement", title: "School update", body: "Read me", sender: "School", room_name: "Group 4", published_at: "2026-09-05T08:00:00.000Z", unread: 1, unread_count: 1, external_url: "", attachment_count: 2, attachment_names_json: '["weekbrief.pdf","foto.jpg"]', synced_at: "2026-09-05T09:00:00.000Z" }] as T[] }; }, async run() { return { meta: { changes: 0 } }; } }),
    batch: async () => [],
  };
  const env = { DB: database };
  const unauthorized = await handleParroApi(new Request("https://personal.test/api/parro/messages"), env);
  assert.equal(unauthorized?.status, 401);
  assert.equal((await unauthorized!.json()).state, "sign_in_required");
  const authorized = await handleParroApi(new Request("https://personal.test/api/parro/messages?limit=6", { headers: { "oai-authenticated-user-id": "owner" } }), env);
  assert.equal(authorized?.status, 200);
  assert.deepEqual((await authorized!.json()).messages[0], { id: "announcement:one", kind: "announcement", title: "School update", body: "Read me", sender: "School", roomName: "Group 4", publishedAt: "2026-09-05T08:00:00.000Z", unread: true, unreadCount: 1, externalUrl: "", attachmentCount: 2, attachmentNames: ["weekbrief.pdf", "foto.jpg"] });
});

test("Parro sync requires the bearer token and writes an atomic snapshot", async () => {
  const queries: string[] = [];
  const statements: ParroStatement[] = [];
  const database: ParroDatabase = {
    prepare: (query) => {
      queries.push(query);
      const statement: ParroStatement = {
        bind() { return statement; },
        async all<T>() { return { results: [] as T[] }; },
        async run() { return { meta: { changes: 1 } }; },
      };
      statements.push(statement);
      return statement;
    },
    batch: async (batch) => { statements.push(...batch); return []; },
  };
  const env = { DB: database, PARRO_SYNC_TOKEN: "sync-secret" };
  const endpoint = "https://personal.test/api/parro/sync";
  assert.equal((await handleParroApi(new Request(endpoint, { method: "POST" }), env))?.status, 401);
  const response = await handleParroApi(new Request(endpoint, {
    method: "POST",
    headers: { Authorization: "Bearer sync-secret", "Content-Type": "application/json" },
    body: JSON.stringify({ replace: true, syncedAt: "2026-09-05T09:00:00Z", messages: [message] }),
  }), env);
  assert.equal(response?.status, 200);
  assert.deepEqual(await response!.json(), { ok: true, count: 1, syncedAt: "2026-09-05T09:00:00.000Z" });
  assert.equal(queries.filter((query) => query.includes("INSERT INTO parro_messages")).length, 1);
  assert.ok(queries.some((query) => query.includes("attachment_names_json")));
  assert.equal(queries.filter((query) => query.includes("DELETE FROM parro_messages")).length, 1);
});

// This in-memory database checks the observable D1 contract, including ownership and
// all-or-nothing snapshot batches, without retaining any real Parro account data.
function directDatabase(failAt: "connection_save" | "snapshot_store" | "" = "") {
  const state = new Map<string, string>();
  let snapshot: unknown[][] = [];
  let lease = false;
  let batches = 0;
  let limit: unknown;
  type Statement = ParroStatement & { query: string; values: unknown[] };
  const database: ParroDatabase = {
    prepare(query) {
      const statement: Statement = {
        query, values: [],
        bind(...values) { statement.values = values; return statement; },
        async all<T>() {
          if (query.includes("workspace_state")) {
            const data = state.get(String(statement.values[0]));
            return { results: (data ? [{ data }] : []) as T[] };
          }
          limit = statement.values[0];
          return { results: [] as T[] };
        },
        async run() {
          if (query.startsWith("INSERT INTO google_sync_lease")) {
            const changes = lease ? 0 : 1; lease = true; return { meta: { changes } };
          }
          if (query.startsWith("DELETE FROM google_sync_lease")) lease = false;
          if (failAt === "connection_save" && query.startsWith("INSERT INTO workspace_state") && statement.values[0] === "parro-connection") throw new Error("RAW_DB_PASSWORD_TOKEN_SENTINEL");
          if (query.startsWith("INSERT INTO workspace_state")) state.set(String(statement.values[0]), String(statement.values[1]));
          if (query.startsWith("UPDATE workspace_state SET data = ?")) state.set(String(statement.values[1]), String(statement.values[0]));
          return { meta: { changes: 1 } };
        },
      };
      return statement;
    },
    async batch(statements) {
      batches++;
      if (failAt === "snapshot_store") throw new Error("RAW_SNAPSHOT_PASSWORD_TOKEN_SENTINEL");
      for (const statement of statements as Statement[]) {
        if (statement.query === "DELETE FROM parro_messages") snapshot = [];
        if (statement.query.startsWith("INSERT INTO parro_messages")) snapshot.push(statement.values);
        if (statement.query.startsWith("DELETE FROM workspace_state")) for (const id of statement.values) state.delete(String(id));
        if (statement.query.startsWith("INSERT INTO workspace_state")) state.set(String(statement.values[0]), String(statement.values[1]));
      }
      return [];
    },
  };
  return { database, state, get snapshot() { return snapshot; }, set snapshot(value: unknown[][]) { snapshot = value; }, get batches() { return batches; }, get lease() { return lease; }, set lease(value) { lease = value; }, get limit() { return limit; } };
}

const directRequest = (path: string, body?: unknown, headers: Record<string, string> = {}) => new Request(`https://personal.test/api/parro/${path}`, {
  method: path === "connection" ? "DELETE" : "POST",
  headers: { Origin: "https://personal.test", "Content-Type": "application/json", "oai-authenticated-user-id": "owner", ...headers },
  body: body === undefined ? undefined : JSON.stringify(body),
});

const chooserHtml = `<script>Wicket.Ajax.baseUrl="idp/?auth=test";
Wicket.Ajax.ajax({"u":"./?-1.IBehaviorListener.0-accountKeuze-accounts-account-0","c":"account-0"});
Wicket.Ajax.ajax({"u":"./?-1.IBehaviorListener.0-accountKeuze-accounts-account-1","c":"account-1"});</script>
<ul><li id="account-0"><span class="account-list__name"><span>Alex Parent</span></span><span class="account-list__role"><span>Guardian</span></span></li>
<li id='account-1'><span class='account-list__name'><span>School Account</span></span><span class='account-list__role'><span>Teacher</span></span></li></ul>`;

test("Parro login follows Wicket redirects, selects an account by role and exchanges PKCE tokens", async (t) => {
  let oauthState = ""; let selected = ""; let tokenExchanges = 0;
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/authorize")) {
      oauthState = url.searchParams.get("state")!;
      return new Response(null, { status: 302, headers: { Location: "/idp/?auth=test" } });
    }
    if (url.search.includes("accountKeuze-accounts-account")) {
      selected = new Headers(init?.headers).get("Wicket-FocusedElementId") || "";
      assert.equal(new Headers(init?.headers).get("Wicket-Ajax-BaseURL"), "idp/?auth=test");
      return new Response('<ajax-response><redirect><![CDATA[/continue]]></redirect></ajax-response>');
    }
    if (url.pathname === "/idp/" && init?.method !== "POST") return new Response('<form action="./?-1.-signIn-mainPanel-signInFormPanel-signInForm&amp;auth=test"><input value="hidden-token" name="csrf" type="hidden"><input name="e-mailadres" autocomplete="username"><input name="wachtwoord" type="password"></form>', { headers: { "Set-Cookie": "sid=login-session; Path=/; Secure; HttpOnly" } });
    if (url.pathname === "/idp/" && init?.method === "POST") {
      const fields = new URLSearchParams(String(init.body));
      assert.equal(url.searchParams.get("auth"), "test", "HTML-escaped form actions retain the authorization query");
      assert.equal(fields.get("e-mailadres"), "parent@example.test"); assert.equal(fields.get("wachtwoord"), "test-password"); assert.equal(fields.get("csrf"), "hidden-token");
      assert.equal(new Headers(init.headers).get("Content-Type"), "application/x-www-form-urlencoded");
      assert.equal(new Headers(init.headers).get("User-Agent"), "Mozilla/5.0 (Macintosh) Parro-CLI/0.1");
      assert.match(new Headers(init.headers).get("Cookie") || "", /sid=login-session/);
      return new Response(chooserHtml);
    }
    if (url.pathname === "/continue") return new Response(null, { status: 302, headers: { Location: `parro://oauth2?code=test-code&state=${oauthState}` } });
    if (url.pathname.endsWith("/token")) {
      tokenExchanges++;
      const fields = new URLSearchParams(String(init?.body));
      assert.equal(fields.get("grant_type"), "authorization_code"); assert.equal(fields.get("code"), "test-code"); assert.ok(fields.get("code_verifier"));
      assert.equal(new Headers(init?.headers).get("Content-Type"), "application/x-www-form-urlencoded");
      assert.equal(new Headers(init?.headers).get("User-Agent"), "Mozilla/5.0 (Macintosh) Parro-CLI/0.1");
      return Response.json({ access_token: "access-token", refresh_token: "refresh-token" });
    }
    throw new Error(`Unexpected URL ${url}`);
  });
  assert.deepEqual(await loginParro("parent@example.test", "test-password", "teacher"), { access_token: "access-token", refresh_token: "refresh-token" });
  assert.equal(selected, "account-1"); assert.equal(tokenExchanges, 1);
});

test("Parro callback follows parro-cli host/state behavior and handles OAuth errors safely", async (t) => {
  let callback = "";
  let challenge = "";
  let tokenExchanges = 0;
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/authorize")) {
      challenge = url.searchParams.get("code_challenge")!;
      return new Response(null, { status: 302, headers: { Location: "/callback" } });
    }
    if (url.pathname === "/callback") return new Response(null, { status: 302, headers: { Location: callback } });
    if (url.pathname.endsWith("/token")) {
      tokenExchanges++;
      const fields = new URLSearchParams(String(init?.body));
      assert.equal(fields.get("grant_type"), "authorization_code");
      assert.equal(fields.get("code"), "legacy-code");
      const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(fields.get("code_verifier")!)));
      assert.equal(btoa(String.fromCharCode(...digest)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""), challenge, "every accepted callback still uses the matching PKCE verifier");
      return Response.json({ access_token: "access-token", refresh_token: "refresh-token" });
    }
    throw new Error(`Unexpected URL ${url.origin}${url.pathname}`);
  });

  callback = "parro://oauth2?code=legacy-code";
  assert.deepEqual(await loginParro("parent@example.test", "test-password"), { access_token: "access-token", refresh_token: "refresh-token" });
  assert.equal(tokenExchanges, 1, "a callback without state is accepted when it contains a code");

  callback = "parro://oauth2?code=legacy-code&state=wrong-state";
  await loginParro("parent@example.test", "test-password");
  assert.equal(tokenExchanges, 2, "parro-cli does not reject a callback because its state differs");

  callback = "parro://?code=legacy-code";
  await loginParro("parent@example.test", "test-password");
  assert.equal(tokenExchanges, 3, "a callback with an empty host is accepted when it contains a code");

  callback = "parro://legacy-client?code=legacy-code&state=wrong-state";
  await loginParro("parent@example.test", "test-password");
  assert.equal(tokenExchanges, 4, "a different callback host is accepted when it contains a code");

  callback = "parro://oauth2?state=present-without-code";
  await assert.rejects(loginParro("parent@example.test", "test-password"), (error: unknown) => {
    assert.ok(error instanceof ParroError); assert.equal(error.code, "oauth_callback_missing_code");
    assert.match(error.message, /zonder autorisatiecode/); return true;
  });
  assert.equal(tokenExchanges, 4, "a callback without a code never reaches token exchange");

  callback = "parro://oauth2?error=access_denied&error_description=private%20provider%20details";
  await assert.rejects(loginParro("parent@example.test", "test-password"), (error: unknown) => {
    assert.ok(error instanceof ParroError); assert.equal(error.code, "oauth_access_denied");
    assert.match(error.message, /aanmelding geweigerd/); assert.doesNotMatch(error.message, /private provider details/); return true;
  });
  assert.equal(tokenExchanges, 4, "OAuth error callbacks are never exchanged for tokens");
});

test("Parro API GETs omit Range and custom User-Agent and reject redirects without following them", async (t) => {
  const calls: URL[] = [];
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input)); calls.push(url);
    const headers = new Headers(init?.headers);
    assert.equal(init?.method, undefined, "ordinary API calls use GET");
    assert.equal(init?.redirect, "manual", "API redirects are surfaced but never followed");
    assert.equal(headers.get("Range"), null, "ordinary _items calls do not page with Range");
    assert.equal(headers.get("User-Agent"), null, "API calls do not use the login-only CLI User-Agent");
    assert.equal(headers.get("Authorization"), "Bearer private-token");
    if (url.pathname.endsWith("/group")) return new Response(null, { status: 302, headers: { Location: "/private-redirect?code=private-code" } });
    if (url.pathname.endsWith("/chatroom")) return Response.json({ items: [] });
    throw new Error("A manual API redirect must not be followed");
  });
  await assert.rejects(fetchParroMessages("private-token", "2026-09-23T12:00:00Z"), (error: unknown) => {
    assert.ok(error instanceof ParroError); assert.equal(error.code, "parro_groups_redirect_rejected");
    assert.match(error.message, /Parro-groepen/); assert.doesNotMatch(error.message, /private-token|private-code/); return true;
  });
  assert.equal(calls.length, 2, "only groups and chatrooms were requested; the redirect target was not followed");
});

test("Parro API network failures carry the affected endpoint without leaking request secrets", async (t) => {
  let failAt: "groups" | "chatrooms" | "announcements" | "chat_messages" = "groups";
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    const headers = new Headers(init?.headers);
    assert.equal(init?.redirect, "manual"); assert.equal(headers.get("Range"), null); assert.equal(headers.get("User-Agent"), null);
    assert.equal(headers.get("Authorization"), "Bearer private-token");
    const fail = () => { throw new TypeError("RAW_PRIVATE_TOKEN_SENTINEL"); };
    if (url.pathname.endsWith("/group")) {
      if (failAt === "groups") fail();
      return Response.json({ items: failAt === "announcements" ? [{ id: 1, name: "Class" }] : [] });
    }
    if (url.pathname.endsWith("/chatroom")) {
      if (failAt === "chatrooms") fail();
      return Response.json({ items: failAt === "chat_messages" ? [{ id: 2, name: "Teacher", unreadCount: 1 }] : [] });
    }
    if (url.pathname.endsWith("/event")) {
      if (failAt === "announcements") fail();
      return Response.json({ items: [] });
    }
    if (url.pathname.endsWith("/chatmessage")) fail();
    throw new Error("Unexpected API endpoint");
  });

  const cases = [
    ["groups", "parro_groups_network_failed", /Parro-groepen/],
    ["chatrooms", "parro_chatrooms_network_failed", /Parro-chatrooms/],
    ["announcements", "parro_announcements_network_failed", /Parro-mededelingen/],
    ["chat_messages", "parro_chat_messages_network_failed", /Parro-chatberichten/],
  ] as const;
  for (const [endpoint, code, label] of cases) {
    failAt = endpoint;
    await assert.rejects(fetchParroMessages("private-token", "2026-09-23T12:00:00Z"), (error: unknown) => {
      assert.ok(error instanceof ParroError); assert.equal(error.code, code); assert.match(error.message, label);
      assert.doesNotMatch(error.message, /RAW_PRIVATE_TOKEN_SENTINEL|private-token/); return true;
    });
  }
});

test("Parro upstream failures identify the login stage without exposing raw errors", async (t) => {
  let failAt: "authorize" | "credential_submit" | "redirect" | "account_choice" | "token_exchange" | "token_redirect" = "authorize";
  const invalidHeaderChooser = chooserHtml.replace('Wicket.Ajax.baseUrl="idp/?auth=test"', 'Wicket.Ajax.baseUrl="bad\nheader"');
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/authorize")) {
      if (failAt === "authorize") throw new TypeError("synthetic failure test-password private-code");
      return new Response('<form action="/login"><input name="emailadres"><input name="wachtwoord" type="password"></form>');
    }
    if (url.pathname === "/login") {
      if (failAt === "credential_submit") throw new TypeError("synthetic failure test-password private-code");
      if (failAt === "redirect") return new Response(null, { status: 302, headers: { Location: "/continue" } });
      if (failAt === "token_exchange" || failAt === "token_redirect") return new Response(null, { status: 302, headers: { Location: "parro://oauth2?code=private-code" } });
      return new Response(invalidHeaderChooser);
    }
    if (url.pathname === "/continue") throw new TypeError("synthetic failure test-password private-code");
    if (url.pathname.endsWith("/token")) {
      if (failAt === "token_redirect") return new Response(null, { status: 302, headers: { Location: "/unexpected-redirect" } });
      throw new TypeError("synthetic failure test-password private-code");
    }
    if (url.search.includes("accountKeuze-accounts-account")) throw new Error("The invalid header should fail before fetch");
    throw new Error("Unexpected test request");
  });

  const cases = [
    ["authorize", "parro_authorize_network_failed"],
    ["credential_submit", "parro_credential_submit_network_failed"],
    ["redirect", "parro_redirect_network_failed"],
    ["token_exchange", "parro_token_exchange_network_failed"],
    ["token_redirect", "parro_token_exchange_redirect_rejected"],
    ["account_choice", "parro_account_choice_headers_invalid"],
  ] as const;
  for (const [stage, code] of cases) {
    failAt = stage;
    await assert.rejects(loginParro("parent@example.test", "test-password"), (error: unknown) => {
      assert.ok(error instanceof ParroError); assert.equal(error.code, code);
      assert.doesNotMatch(error.message, /synthetic failure|test-password|private-code|bad\s+header/);
      return true;
    });
  }
});

test("Parro classifies malformed login URLs without echoing the upstream value", async (t) => {
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/authorize")) return new Response('<form action="http://["><input name="emailadres"><input name="wachtwoord" type="password"></form>');
    throw new Error("Malformed form action should fail before fetch");
  });
  await assert.rejects(loginParro("parent@example.test", "test-password"), (error: unknown) => {
    assert.ok(error instanceof ParroError); assert.equal(error.code, "parro_credential_submit_url_invalid");
    assert.doesNotMatch(error.message, /http:\/\/\[/); return true;
  });
});

test("Parro login reports rejected credentials and extra verification separately", async (t) => {
  let mode: "credentials" | "verification" = "credentials";
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/authorize")) return new Response('<form action="/login"><input name="emailadres"><input name="wachtwoord" type="password"></form>');
    if (url.pathname === "/login") return new Response(mode === "credentials"
      ? '<p>Gebruikersnaam of wachtwoord onjuist</p><form><input name="emailadres"><input name="wachtwoord" type="password"></form>'
      : '<p>Vul de verificatiecode uit je authenticator in</p><form><input name="code"></form>');
    throw new Error(`Unexpected URL ${url.origin}${url.pathname}`);
  });
  await assert.rejects(loginParro("parent@example.test", "wrong-test-password"), (error: unknown) => {
    assert.ok(error instanceof ParroError); assert.equal(error.status, 401); assert.equal(error.code, "credentials_rejected");
    assert.match(error.message, /talk\.parro\.com/); return true;
  });
  mode = "verification";
  await assert.rejects(loginParro("parent@example.test", "test-password"), (error: unknown) => {
    assert.ok(error instanceof ParroError); assert.equal(error.status, 401); assert.equal(error.code, "verification_required");
    assert.match(error.message, /extra verificatiestap/); return true;
  });
});

test("Parro login defaults to the first linked account and reports a missing requested account", async (t) => {
  let oauthState = ""; const selected: string[] = [];
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/authorize")) { oauthState = url.searchParams.get("state")!; return new Response('<form action="/login"><input name="emailadres"><input name="wachtwoord" type="password"></form>'); }
    if (url.pathname === "/login") return new Response(chooserHtml);
    if (url.search.includes("accountKeuze-accounts-account")) { selected.push(new Headers(init?.headers).get("Wicket-FocusedElementId") || ""); return new Response(null, { headers: { "Ajax-Location": `parro://oauth2?code=default-code&state=${oauthState}` } }); }
    if (url.pathname.endsWith("/token")) return Response.json({ access_token: "access-token", refresh_token: "refresh-token" });
    throw new Error(`Unexpected URL ${url}`);
  });
  await loginParro("parent@example.test", "test-password");
  assert.deepEqual(selected, ["account-0"], "an omitted optional account uses the first linked identity like parro-cli");
  await assert.rejects(loginParro("parent@example.test", "test-password", "student"), (error: unknown) => {
    assert.ok(error instanceof ParroError); assert.equal(error.status, 400); assert.match(error.message, /Alex Parent \(Guardian\)/); assert.match(error.message, /School Account \(Teacher\)/); return true;
  });
  assert.deepEqual(selected, ["account-0"], "a missing account is rejected before a Wicket account click");
});

test("direct Parro stages return safe codes when saving, fetching or storing fails", async (t) => {
  const envBase = { PARRO_TOKEN_ENCRYPTION_KEY: btoa("x".repeat(32)) };
  let failMessageFetch = false;
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/authorize")) return new Response('<form action="/login"><input name="emailadres"><input name="wachtwoord" type="password"></form>');
    if (url.pathname === "/login") return new Response(null, { status: 302, headers: { Location: "parro://oauth2?code=test-oauth-code" } });
    if (url.pathname.endsWith("/token")) return Response.json({ access_token: "test-access-token", refresh_token: "test-refresh-token" });
    if (url.pathname.endsWith("/group")) {
      if (failMessageFetch) throw new Error("RAW_UPSTREAM_PASSWORD_TOKEN_SENTINEL");
      return Response.json({ items: [] });
    }
    if (url.pathname.endsWith("/chatroom")) return Response.json({ items: [] });
    throw new Error("Unexpected test request");
  });

  const saveDb = directDatabase("connection_save");
  const saveResponse = await handleParroApi(directRequest("connect", { username: "parent@example.test", password: "test-password" }), { ...envBase, DB: saveDb.database });
  const saveBody = await saveResponse!.json();
  assert.equal(saveResponse?.status, 503); assert.equal(saveBody.code, "parro_connection_save_failed");
  assert.match(saveBody.error, /beveiligde koppeling/); assert.equal(saveDb.state.has("parro-connection"), false); assert.equal(saveBody.connectionSaved, false);

  const fetchDb = directDatabase(); fetchDb.snapshot = [["old-message"]]; failMessageFetch = true;
  const fetchResponse = await handleParroApi(directRequest("connect", { username: "parent@example.test", password: "test-password" }), { ...envBase, DB: fetchDb.database });
  const fetchBody = await fetchResponse!.json();
  assert.equal(fetchResponse?.status, 502); assert.equal(fetchBody.code, "parro_groups_network_failed");
  assert.match(fetchBody.error, /ophalen van Parro-groepen/); assert.ok(fetchDb.state.has("parro-connection")); assert.equal(fetchBody.connectionSaved, true); assert.deepEqual(fetchDb.snapshot, [["old-message"]]);

  const snapshotDb = directDatabase("snapshot_store"); failMessageFetch = false;
  const snapshotResponse = await handleParroApi(directRequest("connect", { username: "parent@example.test", password: "test-password" }), { ...envBase, DB: snapshotDb.database });
  const snapshotBody = await snapshotResponse!.json();
  assert.equal(snapshotResponse?.status, 503); assert.equal(snapshotBody.code, "parro_snapshot_store_failed");
  assert.match(snapshotBody.error, /niet veilig worden opgeslagen/); assert.ok(snapshotDb.state.has("parro-connection")); assert.equal(snapshotBody.connectionSaved, true);
  for (const body of [saveBody, fetchBody, snapshotBody]) {
    assert.equal(typeof body.connectionSaved, "boolean", "failure responses expose only a boolean connectionSaved flag");
    assert.doesNotMatch(body.error, /RAW_|test-password|test-oauth-code|test-access-token|test-refresh-token/);
  }
});

test("direct Parro login, refresh rotation, failed snapshot and ownership", async (t) => {
  const db = directDatabase();
  const env = { DB: db.database, PARRO_TOKEN_ENCRYPTION_KEY: btoa("x".repeat(32)), PARRO_SYNC_TOKEN: "legacy" };
  let state = ""; let challenge = ""; let failMessages = false; let expired = false; let tokenRefreshes = 0; let rejectRefresh = false;
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/authorize")) {
      state = url.searchParams.get("state")!; challenge = url.searchParams.get("code_challenge")!;
      return new Response('<form action="/login"><input type="hidden" name="csrf" value="form-token"><input type="email" name="email"><input type="password" name="pass"></form>', { headers: { "Set-Cookie": "sid=test-session; HttpOnly; Secure" } });
    }
    if (url.pathname === "/login") {
      const fields = new URLSearchParams(String(init?.body));
      assert.equal(fields.get("email"), "parent@example.test"); assert.equal(fields.get("pass"), "test-password"); assert.equal(fields.get("csrf"), "form-token");
      assert.match(new Headers(init?.headers).get("Cookie")!, /sid=test-session/);
      return new Response(null, { status: 302, headers: { Location: "/kies_applicatie" } });
    }
    if (url.pathname === "/kies_applicatie") return new Response('<a href="/other">Other app</a><a href="/parro"><span>Parro</span></a>');
    if (url.pathname === "/parro") return new Response(null, { status: 302, headers: { Location: `parro://oauth2?code=test-code&state=${state}` } });
    if (url.pathname.endsWith("/token")) {
      const fields = new URLSearchParams(String(init?.body));
      if (fields.get("grant_type") === "refresh_token") {
        if (rejectRefresh) { tokenRefreshes++; return Response.json({ error: "invalid_grant" }, { status: 400 }); }
        assert.equal(fields.get("refresh_token"), "refresh-secret"); tokenRefreshes++;
        return Response.json({ access_token: "rotated-access", refresh_token: "rotated-refresh" });
      }
      const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(fields.get("code_verifier")!)));
      assert.equal(btoa(String.fromCharCode(...digest)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""), challenge);
      return Response.json({ access_token: "access-secret", refresh_token: "refresh-secret" });
    }
    assert.ok(init?.signal); // Every request participates in the operation deadline.
    const headers = new Headers(init?.headers);
    assert.ok(["Bearer access-secret", "Bearer rotated-access"].includes(headers.get("Authorization") || ""));
    assert.equal(headers.get("Range"), null);
    assert.equal(headers.get("User-Agent"), null);
    assert.equal(init?.redirect, "manual");
    if (rejectRefresh || expired && new Headers(init?.headers).get("Authorization") === "Bearer access-secret") return new Response(null, { status: 401 });
    if (failMessages) return new Response(null, { status: 503 });
    if (url.pathname.endsWith("/group")) { assert.equal(url.searchParams.get("dtype"), "identity.RHomeGroup"); return Response.json({ items: [{ id: 12, name: "Class" }] }); }
    if (url.pathname.endsWith("/chatroom")) return Response.json({ items: [{ id: 23, name: "Teacher", unreadCount: 2 }] });
    if (url.pathname.endsWith("/chatmessage")) return Response.json({ items: [{ id: 34, text: "Chat preview", createdAt: "2026-09-20T10:00:00Z" }] });
    if (url.pathname.endsWith("/event")) { assert.equal(url.searchParams.get("dtype"), "event.RAnnouncementEvent"); assert.equal(url.searchParams.get("group"), "12"); return Response.json({ items: [{ id: 45, title: "Class update", contents: "Announcement preview", createdAt: "2026-09-20T09:00:00Z", read: false }] }); }
    throw new Error(`Unexpected URL ${url.origin}${url.pathname}`);
  });
  const connect = await handleParroApi(directRequest("connect", { username: "parent@example.test", password: "test-password" }), env);
  assert.equal(connect?.status, 200); assert.equal((await connect!.json()).count, 2);
  assert.equal(db.snapshot.length, 2); assert.equal(db.lease, false);
  const encrypted = db.state.get("parro-connection")!;
  for (const secret of ["test-password", "parent@example.test", "access-secret", "refresh-secret"]) assert.equal(encrypted.includes(secret), false);
  const compact = await handleParroApi(new Request("https://personal.test/api/parro/messages?limit=4", { headers: { "oai-authenticated-user-id": "owner" } }), env);
  assert.equal(compact?.status, 200); assert.equal(db.limit, 4);
  const before = JSON.stringify(db.snapshot); const batches = db.batches;
  expired = true; failMessages = true;
  const failed = await handleParroApi(directRequest("refresh"), env);
  assert.equal(failed?.status, 502); assert.equal(tokenRefreshes, 1);
  assert.notEqual(db.state.get("parro-connection"), encrypted, "rotated token persists even when message fetch fails");
  assert.equal(JSON.stringify(db.snapshot), before); assert.equal(db.batches, batches); assert.equal(db.lease, false);
  failMessages = false;
  assert.equal((await handleParroApi(directRequest("refresh"), env))?.status, 200);
  assert.equal(tokenRefreshes, 1, "next request uses rotated access token");
  assert.equal((await handleParroApi(directRequest("refresh", undefined, { Origin: "https://evil.test" }), env))?.status, 403);
  assert.equal((await handleParroApi(directRequest("refresh", undefined, { "oai-authenticated-user-id": "other" }), env))?.status, 403);
  assert.equal((await handleParroApi(new Request("https://personal.test/api/parro/messages", { headers: { "oai-authenticated-user-id": "other" } }), env))?.status, 403);
  db.lease = true;
  assert.equal((await handleParroApi(directRequest("refresh"), env))?.status, 409); db.lease = false;
  assert.equal((await handleParroApi(new Request("https://personal.test/api/parro/sync", { method: "POST", headers: { Authorization: "Bearer legacy" } }), env))?.status, 409);
  rejectRefresh = true;
  const beforeExpiry = JSON.stringify(db.snapshot);
  const expiredRefresh = await handleParroApi(directRequest("refresh"), env);
  assert.equal(expiredRefresh?.status, 401);
  assert.equal((await expiredRefresh!.json()).connectionSaved, false, "rejected refresh cannot be reported as a usable saved connection");
  assert.equal(JSON.parse(db.state.get("parro-connection")!).needsSignIn, true);
  assert.equal(JSON.stringify(db.snapshot), beforeExpiry, "expired sessions preserve saved messages");
  const expiredStatus = await handleParroApi(new Request("https://personal.test/api/parro/messages", { headers: { "oai-authenticated-user-id": "owner" } }), env);
  assert.equal((await expiredStatus!.json()).connectionState, "disconnected");
  assert.equal((await handleParroApi(directRequest("refresh"), env))?.status, 401);
  assert.equal(tokenRefreshes, 2, "expired connection is not retried upstream after reload");
  assert.equal((await handleParroApi(new Request("https://personal.test/api/parro/messages", { headers: { "oai-authenticated-user-id": "other" } }), env))?.status, 403, "expiry retains ownership protection");
  rejectRefresh = false;
  expired = false;
  assert.equal((await handleParroApi(directRequest("connect", { username: "parent@example.test", password: "test-password" }), env))?.status, 200);
  assert.equal(JSON.parse(db.state.get("parro-connection")!).needsSignIn, undefined, "successful reconnect clears expiry state");
  assert.equal((await handleParroApi(directRequest("connection"), env))?.status, 200);
  assert.equal(db.state.has("parro-connection"), false); assert.equal(db.snapshot.length, 0);
});

test("rejected reconnect never reports the previous connection as a newly saved login", async (t) => {
  const diagnostics: unknown[][] = [];
  t.mock.method(console, "warn", (...args: unknown[]) => diagnostics.push(args));
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/authorize")) return new Response('<form action="/login"><input name="emailadres"><input name="wachtwoord" type="password"></form>');
    if (url.pathname === "/login") return new Response('<p>Inlog afgewezen</p><form><input name="wachtwoord" type="password"></form>');
    throw new Error("Unexpected test endpoint");
  });
  for (const needsSignIn of [false, true]) {
    const db = directDatabase();
    const saved = JSON.stringify({ owner: "owner", encrypted: "PRIVATE_EXISTING_TOKEN", needsSignIn });
    db.state.set("parro-connection", saved);
    db.snapshot = [["private-existing-message"]];
    const response = await handleParroApi(directRequest("connect", { username: "private-parent@example.test", password: "PRIVATE_PASSWORD" }), { DB: db.database, PARRO_TOKEN_ENCRYPTION_KEY: btoa("x".repeat(32)) });
    assert.equal(response?.status, 401);
    const body = await response!.json();
    assert.equal(body.connectionSaved, false);
    assert.equal(body.state, "sign_in_required");
    assert.equal(body.code, "credentials_rejected");
    assert.equal(db.state.get("parro-connection"), saved, "failed reconnect preserves the old connection");
    assert.deepEqual(db.snapshot, [["private-existing-message"]]);
    assert.equal(db.lease, false);
  }
  assert.equal(diagnostics.length, 2);
  assert.deepEqual(diagnostics[0], ["Parro operation failed", { operation: "connect", stage: "login", status: 401, code: "credentials_rejected", connectionSaved: false }]);
  assert.doesNotMatch(JSON.stringify(diagnostics), /PRIVATE_|private-parent|private-existing/);
});
