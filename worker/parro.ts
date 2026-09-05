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
};

export type ParroMessagesResponse = {
  state: "connected" | "empty" | "unavailable" | "unconfigured" | "sign_in_required";
  messages: ParroMessage[];
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
  synced_at: string;
};

const MAX_PAYLOAD_BYTES = 300_000;
const MAX_MESSAGES = 200;
const MAX_TITLE_LENGTH = 240;
const MAX_BODY_LENGTH = 1_600;
const MAX_SENDER_LENGTH = 160;
const MAX_ROOM_LENGTH = 240;
const MAX_URL_LENGTH = 1_000;
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

const normalizeMessage = (value: unknown, syncedAt: string): IncomingMessage | null => {
  if (!isRecord(value) || typeof value.id !== "string" || !ID_PATTERN.test(value.id) || (value.kind !== "announcement" && value.kind !== "chatroom")) return null;
  const title = cleanText(value.title, MAX_TITLE_LENGTH);
  if (!title) return null;
  const unreadCount = safeInteger(value.unreadCount);
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
  };
};

export const sanitizeParroPayload = (value: unknown, now = new Date().toISOString()): IncomingPayload | null => {
  if (!isRecord(value) || !Array.isArray(value.messages) || value.messages.length > MAX_MESSAGES) return null;
  const syncedAt = isoDate(value.syncedAt, now);
  const messages = value.messages.map((message) => normalizeMessage(message, syncedAt)).filter((message): message is IncomingMessage => message !== null);
  if (messages.length !== value.messages.length) return null;
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
  const rows = await database.prepare(`SELECT id, kind, title, body, sender, room_name, published_at, unread, unread_count, external_url, synced_at
FROM parro_messages
ORDER BY published_at DESC, id DESC
LIMIT ?`).bind(limit).all<StoredMessage>();
  const messages = rows.results.map((row) => ({
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
  } satisfies ParroMessage));
  const unread = messages.reduce((total, message) => total + (message.unreadCount || (message.unread ? 1 : 0)), 0);
  const syncedAt = rows.results.reduce((latest, row) => row.synced_at > latest ? row.synced_at : latest, "");
  return { state: messages.length ? "connected" : "empty", messages, syncedAt: syncedAt || undefined, unread };
};

const handleRead = async (request: Request, env: ParroEnv, url: URL) => {
  if (!isLocalRequest(request) && !request.headers.get("oai-authenticated-user-id")) return json({ state: "sign_in_required", messages: [] }, 401);
  if (!env.DB) return json({ state: "unconfigured", messages: [] });
  const requestedLimit = Number(url.searchParams.get("limit"));
  const limit = requestedLimit === 5 || requestedLimit === 6 ? requestedLimit : 20;
  try {
    return json(await readMessages(env.DB, limit));
  } catch {
    return json({ state: "unavailable", messages: [] }, 503);
  }
};

const authorizedSync = (request: Request, env: ParroEnv) => Boolean(env.PARRO_SYNC_TOKEN)
  && request.headers.get("Authorization") === `Bearer ${env.PARRO_SYNC_TOKEN}`;

const handleSync = async (request: Request, env: ParroEnv) => {
  if (request.method !== "POST") return new Response(null, { status: 405, headers: { Allow: "POST" } });
  if (!env.PARRO_SYNC_TOKEN) return json({ error: "Parro sync is not configured" }, 503);
  if (!authorizedSync(request, env)) return json({ error: "Unauthorized" }, 401);
  if (!env.DB) return json({ error: "D1 database is not configured" }, 503);
  if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) return json({ error: "Expected an application/json request" }, 415);
  const declaredLength = Number(request.headers.get("Content-Length") || 0);
  if (declaredLength > MAX_PAYLOAD_BYTES) return json({ error: "Parro payload exceeds the storage limit" }, 413);
  const body = await request.arrayBuffer().catch(() => null);
  if (!body || body.byteLength > MAX_PAYLOAD_BYTES) return json({ error: "Parro payload exceeds the storage limit" }, 413);
  let parsed: unknown = null;
  try { parsed = JSON.parse(new TextDecoder().decode(body)); } catch { /* Invalid JSON is reported below. */ }
  const payload = sanitizeParroPayload(parsed);
  if (!payload) return json({ error: "Invalid Parro payload" }, 400);
  const statements = payload.messages.map((message) => env.DB!.prepare(`INSERT INTO parro_messages
(id, kind, title, body, sender, room_name, published_at, unread, unread_count, external_url, synced_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
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
      payload.syncedAt,
    ));
  if (payload.replace) statements.push(env.DB.prepare("DELETE FROM parro_messages WHERE synced_at <> ?").bind(payload.syncedAt));
  await env.DB.batch(statements);
  return json({ ok: true, count: payload.messages.length, syncedAt: payload.syncedAt });
};

export async function handleParroApi(request: Request, env: ParroEnv, url = new URL(request.url)): Promise<Response | null> {
  if (url.pathname === "/api/parro/messages") {
    if (request.method !== "GET") return new Response(null, { status: 405, headers: { Allow: "GET" } });
    return handleRead(request, env, url);
  }
  if (url.pathname === "/api/parro/sync") return handleSync(request, env);
  return null;
}
