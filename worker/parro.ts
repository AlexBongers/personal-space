import { fetchParroMessages, limitedText, loginParro, ParroError, refreshParroTokens, type ParroTokens } from "./parro-client.ts";

export type ParroMessageKind = "announcement" | "chatroom";

export type ParroMessage = {
  id: string;
  kind: ParroMessageKind;
  title: string;
  body: string;
  sender: string;
  roomName: string;
  publishedAt: string;
  unread: boolean;
  unreadCount: number;
  externalUrl: string;
  attachmentCount: number;
  attachmentNames: string[];
};

export type ParroMessagesResponse = {
  state: "connected" | "empty" | "unavailable" | "unconfigured" | "sign_in_required";
  messages: ParroMessage[];
  connectionState?: "connected" | "disconnected" | "unconfigured";
  syncedAt?: string;
  unread?: number;
  error?: string;
};

export interface ParroStatement {
  bind(...values: unknown[]): ParroStatement;
  all<T>(): Promise<{ results: T[] }>;
  run(): Promise<{ meta?: { changes?: number } }>;
}

export interface ParroDatabase {
  prepare(query: string): ParroStatement;
  batch(statements: ParroStatement[]): Promise<unknown[]>;
}

export interface ParroEnv {
  DB?: ParroDatabase;
  PARRO_SYNC_TOKEN?: string;
  PARRO_TOKEN_ENCRYPTION_KEY?: string;
  GOOGLE_TOKEN_ENCRYPTION_KEY?: string;
}

type IncomingMessage = {
  id: string;
  kind: ParroMessageKind;
  title: string;
  body: string;
  sender: string;
  roomName: string;
  publishedAt: string;
  unread: boolean;
  unreadCount: number;
  externalUrl: string;
  attachmentCount: number;
  attachmentNames: string[];
};

type IncomingPayload = {
  replace: boolean;
  syncedAt: string;
  messages: IncomingMessage[];
};

type StoredMessage = {
  id: string;
  kind: string;
  title: string;
  body: string;
  sender: string;
  room_name: string;
  published_at: string;
  unread: number;
  unread_count: number;
  external_url: string;
  attachment_count: number;
  attachment_names_json: string;
  synced_at: string;
};

const MAX_PAYLOAD_BYTES = 1_250_000;
const MAX_MESSAGES = 200;
const MAX_TITLE_LENGTH = 240;
const MAX_BODY_LENGTH = 20_000;
const MAX_SENDER_LENGTH = 160;
const MAX_ROOM_LENGTH = 240;
const MAX_URL_LENGTH = 1_000;
const MAX_ATTACHMENT_NAMES = 12;
const MAX_ATTACHMENT_NAME_LENGTH = 160;
const ID_PATTERN = /^[a-zA-Z0-9:_-]{1,240}$/;
const PARRO_HOSTS = ["parro.com", "parnassys.net"];

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);

const cleanText = (value: unknown, maxLength: number) => typeof value === "string"
  ? value.replace(/\s+/g, " ").trim().slice(0, maxLength)
  : "";

const isoDate = (value: unknown, fallback: string) => {
  const candidate = typeof value === "string" ? value : "";
  const timestamp = Date.parse(candidate);
  return Number.isNaN(timestamp) ? fallback : new Date(timestamp).toISOString();
};

const safeUrl = (value: unknown) => {
  if (typeof value !== "string" || value.length > MAX_URL_LENGTH) return "";
  try {
    const url = new URL(value);
    const allowedHost = PARRO_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
    return url.protocol === "https:" && !url.username && !url.password && allowedHost ? url.toString() : "";
  } catch {
    return "";
  }
};

const safeInteger = (value: unknown) => typeof value === "number" && Number.isInteger(value)
  ? Math.min(999, Math.max(0, value))
  : 0;

const attachmentNames = (value: unknown) => {
  if (!Array.isArray(value) || value.length > MAX_ATTACHMENT_NAMES) return [];
  return [...new Set(value.map((name) => cleanText(name, MAX_ATTACHMENT_NAME_LENGTH)).filter(Boolean))];
};

const storedAttachmentNames = (value: string) => {
  try { return attachmentNames(JSON.parse(value)); } catch { return []; }
};

const normalizeMessage = (value: unknown, syncedAt: string): IncomingMessage | null => {
  if (!isRecord(value) || typeof value.id !== "string" || !ID_PATTERN.test(value.id) || (value.kind !== "announcement" && value.kind !== "chatroom")) return null;
  const title = cleanText(value.title, MAX_TITLE_LENGTH);
  if (!title) return null;
  const unreadCount = safeInteger(value.unreadCount);
  const names = attachmentNames(value.attachmentNames);
  const count = Math.max(safeInteger(value.attachmentCount), names.length);
  return {
    id: value.id,
    kind: value.kind,
    title,
    body: cleanText(value.body, MAX_BODY_LENGTH),
    sender: cleanText(value.sender, MAX_SENDER_LENGTH),
    roomName: cleanText(value.roomName, MAX_ROOM_LENGTH),
    publishedAt: isoDate(value.publishedAt, syncedAt),
    unread: value.unread === true || unreadCount > 0,
    unreadCount,
    externalUrl: safeUrl(value.externalUrl),
    attachmentCount: count,
    attachmentNames: names,
  };
};

export const sanitizeParroPayload = (value: unknown, now = new Date().toISOString()): IncomingPayload | null => {
  if (!isRecord(value) || !Array.isArray(value.messages) || value.messages.length > MAX_MESSAGES) return null;
  const syncedAt = isoDate(value.syncedAt, now);
  const messages = value.messages.map((message) => normalizeMessage(message, syncedAt)).filter((message): message is IncomingMessage => message !== null);
  if (messages.length !== value.messages.length || new Set(messages.map((message) => message.id)).size !== messages.length) return null;
  return { replace: value.replace === true, syncedAt, messages };
};

const json = (body: unknown, status = 200) => Response.json(body, {
  status,
  headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
});

const isLocalRequest = (request: Request) => {
  const hostname = new URL(request.url).hostname;
  return hostname === "localhost" || hostname === "127.0.0.1";
};

const readMessages = async (database: ParroDatabase, limit: number): Promise<ParroMessagesResponse> => {
  const rows = await database.prepare(`SELECT id, kind, title, body, sender, room_name, published_at, unread, unread_count, external_url, attachment_count, attachment_names_json, synced_at
FROM parro_messages
ORDER BY published_at DESC, id DESC
LIMIT ?`).bind(limit).all<StoredMessage>();
  const messages = rows.results.map((row) => {
    const names = storedAttachmentNames(row.attachment_names_json);
    return ({
    id: row.id,
    kind: row.kind === "chatroom" ? "chatroom" : "announcement",
    title: row.title,
    body: row.body,
    sender: row.sender,
    roomName: row.room_name,
    publishedAt: row.published_at,
    unread: Number(row.unread) > 0,
    unreadCount: Math.max(0, Number(row.unread_count) || 0),
    externalUrl: row.external_url,
    attachmentCount: Math.max(names.length, Math.max(0, Number(row.attachment_count) || 0)),
    attachmentNames: names,
  } satisfies ParroMessage);
  });
  const unread = messages.reduce((total, message) => total + (message.unreadCount || (message.unread ? 1 : 0)), 0);
  const metadata = await database.prepare("SELECT data FROM workspace_state WHERE id = ?").bind("parro-sync").all<{ data: string }>();
  let lastSync = "";
  try { lastSync = isoDate(JSON.parse(metadata.results[0]?.data || "null")?.syncedAt, ""); } catch { /* Legacy snapshots use message timestamps. */ }
  const syncedAt = rows.results.reduce((latest, row) => row.synced_at > latest ? row.synced_at : latest, lastSync);
  return { state: messages.length ? "connected" : "empty", messages, syncedAt: syncedAt || undefined, unread };
};

const handleRead = async (request: Request, env: ParroEnv, url: URL) => {
  if (!isLocalRequest(request) && !request.headers.get("oai-authenticated-user-id")) return json({ state: "sign_in_required", messages: [] }, 401);
  if (!env.DB) return json({ state: "unconfigured", messages: [] });
  const requestedLimit = Number(url.searchParams.get("limit"));
  const limit = Number.isInteger(requestedLimit) && requestedLimit >= 1 && requestedLimit <= 20 ? requestedLimit : 20;
  try {
    const connection = await readConnection(env.DB);
    if (connection && connection.owner !== ownerId(request)) return json({ state: "sign_in_required", messages: [] }, 403);
    return json({ ...await readMessages(env.DB, limit), connectionState: !tokenKey(env) ? "unconfigured" : connection ? "connected" : "disconnected" });
  } catch {
    return json({ state: "unavailable", messages: [] }, 503);
  }
};

const authorizedSync = (request: Request, env: ParroEnv) => Boolean(env.PARRO_SYNC_TOKEN)
  && request.headers.get("Authorization") === `Bearer ${env.PARRO_SYNC_TOKEN}`;

const handleLegacySync = async (request: Request, env: ParroEnv) => {
  if (request.method !== "POST") return new Response(null, { status: 405, headers: { Allow: "POST" } });
  if (!env.PARRO_SYNC_TOKEN) return json({ error: "Parro sync is not configured" }, 503);
  if (!authorizedSync(request, env)) return json({ error: "Unauthorized" }, 401);
  if (!env.DB) return json({ error: "D1 database is not configured" }, 503);
  if (await readConnection(env.DB)) return json({ error: "Parro synchroniseert rechtstreeks; lokale imports zijn uitgeschakeld" }, 409);
  if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) return json({ error: "Expected an application/json request" }, 415);
  const declaredLength = Number(request.headers.get("Content-Length") || 0);
  if (declaredLength > MAX_PAYLOAD_BYTES) return json({ error: "Parro payload exceeds the storage limit" }, 413);
  const body = await limitedText(request, MAX_PAYLOAD_BYTES).catch(() => null);
  if (body === null) return json({ error: "Parro payload exceeds the storage limit" }, 413);
  let parsed: unknown = null;
  try { parsed = JSON.parse(body); } catch { /* Invalid JSON is reported below. */ }
  const payload = sanitizeParroPayload(parsed);
  if (!payload) return json({ error: "Invalid Parro payload" }, 400);
  return storeSnapshot(env.DB, payload);
};

// The legacy importer shares the direct-sync lease so an in-flight NAS upload
// cannot replace a new direct connection's first snapshot.
const handleSync = async (request: Request, env: ParroEnv) => {
  if (request.method !== "POST" || !env.DB || !authorizedSync(request, env)) return handleLegacySync(request, env);
  const leaseOwner = crypto.randomUUID();
  const lease = await env.DB.prepare(`INSERT INTO google_sync_lease (id, owner, expires_at) VALUES (?, ?, ?)
ON CONFLICT(id) DO UPDATE SET owner = excluded.owner, expires_at = excluded.expires_at WHERE google_sync_lease.expires_at <= ?`)
    .bind("parro", leaseOwner, Date.now() + 600_000, Date.now()).run();
  if (!lease.meta?.changes) return json({ error: "Parro wordt al gesynchroniseerd." }, 409);
  try { return await handleLegacySync(request, env); }
  finally { await env.DB.prepare("DELETE FROM google_sync_lease WHERE id = ? AND owner = ?").bind("parro", leaseOwner).run().catch(() => {}); }
};

const storeSnapshot = async (database: ParroDatabase, payload: IncomingPayload, direct = false) => {
  try {
    const statements = payload.messages.map((message) => database.prepare(`INSERT INTO parro_messages
(id, kind, title, body, sender, room_name, published_at, unread, unread_count, external_url, attachment_count, attachment_names_json, synced_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
ON CONFLICT(id) DO UPDATE SET
kind = excluded.kind,
title = excluded.title,
body = excluded.body,
sender = excluded.sender,
room_name = excluded.room_name,
published_at = excluded.published_at,
unread = excluded.unread,
unread_count = excluded.unread_count,
external_url = excluded.external_url,
attachment_count = excluded.attachment_count,
attachment_names_json = excluded.attachment_names_json,
synced_at = excluded.synced_at,
updated_at = CURRENT_TIMESTAMP`).bind(
      message.id,
      message.kind,
      message.title,
      message.body,
      message.sender,
      message.roomName,
      message.publishedAt,
      message.unread ? 1 : 0,
      message.unreadCount,
      message.externalUrl,
      message.attachmentCount,
      JSON.stringify(message.attachmentNames),
      payload.syncedAt,
    ));
    // Clear first in the atomic batch: timestamps are not snapshot identifiers.
    if (payload.replace) statements.unshift(database.prepare("DELETE FROM parro_messages"));
    statements.push(database.prepare(`INSERT INTO workspace_state (id, revision, data)
VALUES (?, 1, ?)
ON CONFLICT(id) DO UPDATE SET data = excluded.data, revision = revision + 1, updated_at = CURRENT_TIMESTAMP`)
    .bind("parro-sync", JSON.stringify({ syncedAt: payload.syncedAt })));
    await database.batch(statements);
  } catch {
    if (direct) throw new ParroError("Parro-berichten zijn opgehaald, maar konden niet veilig worden opgeslagen. Probeer opnieuw.", 503, "parro_snapshot_store_failed");
    return json({ error: "Parro snapshot could not be stored; retry the sync" }, 503);
  }
  return json({ ok: true, count: payload.messages.length, syncedAt: payload.syncedAt });
};

export async function handleParroApi(request: Request, env: ParroEnv, url = new URL(request.url)): Promise<Response | null> {
  if (url.pathname === "/api/parro/messages") {
    if (request.method !== "GET") return new Response(null, { status: 405, headers: { Allow: "GET" } });
    return handleRead(request, env, url);
  }
  if (url.pathname === "/api/parro/sync") return handleSync(request, env);
  if (["/api/parro/connect", "/api/parro/refresh", "/api/parro/connection"].includes(url.pathname)) return handleDirectSync(request, env, url);
  return null;
}

const CONNECTION_ID = "parro-connection";
const ownerId = (request: Request) => request.headers.get("oai-authenticated-user-id") || (isLocalRequest(request) ? "local" : "");
const tokenKey = (env: ParroEnv) => env.PARRO_TOKEN_ENCRYPTION_KEY || env.GOOGLE_TOKEN_ENCRYPTION_KEY;
type Connection = { owner: string; encrypted: string };
const readConnection = async (database: ParroDatabase): Promise<Connection | null> => {
  const rows = await database.prepare("SELECT data FROM workspace_state WHERE id = ?").bind(CONNECTION_ID).all<{ data: string }>();
  if (!rows.results[0]?.data) return null;
  const value: unknown = JSON.parse(rows.results[0].data);
  if (!isRecord(value) || typeof value.owner !== "string" || typeof value.encrypted !== "string") throw new ParroError("De opgeslagen Parro-koppeling is ongeldig.");
  return { owner: value.owner, encrypted: value.encrypted };
};
const keyBytes = (value: string) => Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), (char) => char.charCodeAt(0));
const encryptionKey = async (env: ParroEnv) => {
  const raw = keyBytes(tokenKey(env) || "");
  if (raw.byteLength !== 32) throw new ParroError("Parro-tokenbeveiliging is nog niet ingesteld.", 503);
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
};
const encryptTokens = async (tokens: ParroTokens, owner: string, env: ParroEnv) => {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: new TextEncoder().encode(`personal-space:parro:${owner}`) }, await encryptionKey(env), new TextEncoder().encode(JSON.stringify(tokens))));
  const bytes = new Uint8Array(iv.length + cipher.length); bytes.set(iv); bytes.set(cipher, iv.length);
  return btoa(String.fromCharCode(...bytes));
};
const decryptTokens = async (connection: Connection, env: ParroEnv): Promise<ParroTokens> => {
  const bytes = keyBytes(connection.encrypted);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.slice(0, 12), additionalData: new TextEncoder().encode(`personal-space:parro:${connection.owner}`) }, await encryptionKey(env), bytes.slice(12));
  return JSON.parse(new TextDecoder().decode(plain));
};
const saveConnection = async (database: ParroDatabase, tokens: ParroTokens, owner: string, env: ParroEnv) => {
  const data = JSON.stringify({ owner, encrypted: await encryptTokens(tokens, owner, env) });
  await database.prepare(`INSERT INTO workspace_state (id, revision, data) VALUES (?, 1, ?)
ON CONFLICT(id) DO UPDATE SET data = excluded.data, revision = revision + 1, updated_at = CURRENT_TIMESTAMP`).bind(CONNECTION_ID, data).run();
};
type DirectStage = "connection_save" | "message_fetch" | "snapshot_store";
const directStageFailure: Record<DirectStage, { status: number; code: string; message: string }> = {
  connection_save: { status: 503, code: "parro_connection_save_failed", message: "De Parro-inlog is gelukt, maar de beveiligde koppeling kon niet worden opgeslagen. Probeer opnieuw." },
  message_fetch: { status: 502, code: "parro_message_fetch_failed", message: "De Parro-koppeling is gelukt, maar berichten konden niet worden opgehaald. Probeer het later opnieuw." },
  snapshot_store: { status: 503, code: "parro_snapshot_store_failed", message: "Parro-berichten zijn opgehaald, maar konden niet veilig worden opgeslagen. Probeer opnieuw." },
};
const runDirectStage = async <T>(stage: DirectStage, operation: () => Promise<T>): Promise<T> => {
  try { return await operation(); }
  catch (error) {
    if (error instanceof ParroError) throw error;
    const failure = directStageFailure[stage];
    throw new ParroError(failure.message, failure.status, failure.code);
  }
};
const handleDirectSync = async (request: Request, env: ParroEnv, url: URL) => {
  const method = url.pathname.endsWith("/connection") ? "DELETE" : "POST";
  if (request.method !== method) return new Response(null, { status: 405, headers: { Allow: method } });
  const owner = ownerId(request);
  if (!owner) return json({ error: "Log eerst in op Personal Space.", state: "sign_in_required" }, 401);
  if (request.headers.get("Origin") !== url.origin || request.headers.get("Sec-Fetch-Site") === "cross-site") return json({ error: "Ongeldige aanvraagherkomst." }, 403);
  if (!env.DB || !tokenKey(env)) return json({ error: "Parro synchronisatie is nog niet geconfigureerd.", state: "unconfigured" }, 503);
  const database = env.DB;
  // One shared deadline bounds login, retries and all message requests well within the lease.
  const signal = AbortSignal.timeout(90_000);
  const leaseOwner = crypto.randomUUID();
  let leased = false;
  let connectionSaved = false;
  try {
    const lease = await database.prepare(`INSERT INTO google_sync_lease (id, owner, expires_at) VALUES (?, ?, ?)
ON CONFLICT(id) DO UPDATE SET owner = excluded.owner, expires_at = excluded.expires_at WHERE google_sync_lease.expires_at <= ?`)
      .bind("parro", leaseOwner, Date.now() + 600_000, Date.now()).run();
    if (!lease.meta?.changes) return json({ error: "Parro wordt al gesynchroniseerd. Probeer zo nog eens." }, 409);
    leased = true;
    const connection = await readConnection(database);
    connectionSaved = Boolean(connection);
    if (connection && connection.owner !== owner) return json({ error: "Deze Parro-koppeling hoort bij een andere gebruiker." }, 403);
    if (method === "DELETE") {
      await database.batch([database.prepare("DELETE FROM workspace_state WHERE id IN (?, ?)").bind(CONNECTION_ID, "parro-sync"), database.prepare("DELETE FROM parro_messages")]);
      return json({ ok: true });
    }
    let tokens: ParroTokens;
    if (url.pathname.endsWith("/connect")) {
      if (!request.headers.get("Content-Type")?.startsWith("application/json")) return json({ error: "Een JSON-aanvraag is vereist." }, 415);
      const body = await limitedText(request, 10_000).catch(() => null);
      if (body === null) return json({ error: "De inlogaanvraag is te groot." }, 413);
      let input: unknown; try { input = JSON.parse(body); } catch { return json({ error: "Ongeldige inlogaanvraag." }, 400); }
      if (!isRecord(input) || typeof input.username !== "string" || !input.username.trim() || input.username.length > 320 || typeof input.password !== "string" || !input.password || input.password.length > 2_000 || input.account !== undefined && (typeof input.account !== "string" || input.account.length > 200)) return json({ error: "Vul je Parro-e-mailadres en wachtwoord in." }, 400);
      tokens = await loginParro(input.username.trim(), input.password, typeof input.account === "string" ? input.account.trim() : "", signal);
      // Preserve the login even if fetching messages fails afterwards.
      await runDirectStage("connection_save", () => saveConnection(database, tokens, owner, env));
      connectionSaved = true;
    } else {
      if (!connection) return json({ error: "Verbind Parro eerst met je account.", state: "sign_in_required" }, 401);
      tokens = await decryptTokens(connection, env);
    }
    const syncedAt = new Date().toISOString();
    let messages: unknown[];
    try { messages = await runDirectStage("message_fetch", () => fetchParroMessages(tokens.access_token, syncedAt, signal)); }
    catch (error) {
      if (!(error instanceof ParroError) || error.status !== 401) throw error;
      tokens = await refreshParroTokens(tokens.refresh_token, signal);
      // Persist a rotated refresh token before subsequent API calls can fail.
      await runDirectStage("connection_save", () => saveConnection(database, tokens, owner, env));
      connectionSaved = true;
      messages = await runDirectStage("message_fetch", () => fetchParroMessages(tokens.access_token, syncedAt, signal));
    }
    const payload = sanitizeParroPayload({ messages, syncedAt, replace: true });
    if (!payload) throw new ParroError("Parro gaf ongeldige berichten; de bestaande berichten blijven bewaard.");
    await runDirectStage("connection_save", () => saveConnection(database, tokens, owner, env));
    connectionSaved = true;
    return await runDirectStage("snapshot_store", () => storeSnapshot(database, payload, true));
  } catch (error) {
    const status = error instanceof ParroError ? error.status : 502;
    const message = error instanceof ParroError ? error.message : "Parro synchroniseren is tijdelijk mislukt. Probeer opnieuw; bestaande berichten blijven bewaard.";
    return json({ error: message, code: error instanceof ParroError ? error.code : "parro_unavailable", state: status === 401 ? "sign_in_required" : "unavailable", connectionSaved }, status);
  } finally {
    if (leased) await database.prepare("DELETE FROM google_sync_lease WHERE id = ? AND owner = ?").bind("parro", leaseOwner).run().catch(() => {});
  }
};
