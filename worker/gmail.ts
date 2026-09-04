import { getGoogleAccessToken, isGoogleTasksConfigured, type GoogleTasksEnv } from "./google-tasks.ts";
import { decodeEntities } from "./news.ts";
import type { GmailInboxResponse, GmailMessage, GmailState } from "../app/personal-space/gmail-types.ts";

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";
type ApiMessage = { id: string; threadId: string; snippet?: string; internalDate?: string; labelIds?: string[]; payload?: { headers?: Array<{ name: string; value: string }> } };
class GmailError extends Error {
  state: GmailState;
  status: number;
  constructor(state: GmailState, status: number) { super(state); this.state = state; this.status = status; }
}

export function gmailMessage(message: ApiMessage, emailAddress: string): GmailMessage {
  const header = (name: string) => decodeEntities(message.payload?.headers?.find((entry) => entry.name.toLowerCase() === name)?.value || "").slice(0, 500);
  const timestamp = Number(message.internalDate);
  const date = new Date(timestamp);
  return {
    id: message.id, threadId: message.threadId,
    subject: header("subject"), sender: header("from"), snippet: decodeEntities(message.snippet || "").slice(0, 600),
    receivedAt: Number.isFinite(timestamp) && !Number.isNaN(date.getTime()) ? date.toISOString() : "",
    unread: message.labelIds?.includes("UNREAD") || false,
    url: `https://mail.google.com/mail/?authuser=${encodeURIComponent(emailAddress)}#inbox/${encodeURIComponent(message.threadId)}`,
  };
}

export async function readGmailInbox(token: string, limit: number, pageToken = ""): Promise<GmailInboxResponse> {
  const signal = AbortSignal.timeout(15000);
  const get = async <T>(path: string): Promise<T> => {
    const response = await fetch(`${GMAIL_API}/${path}`, { headers: { Authorization: `Bearer ${token}` }, signal });
    const body = await response.json() as { error?: { message?: string; errors?: Array<{ reason?: string }>; details?: Array<{ reason?: string }> } };
    if (!response.ok) {
      const reasons = [...(body.error?.errors || []), ...(body.error?.details || [])].map((entry) => entry.reason?.toLowerCase());
      const disabled = reasons.includes("service_disabled") || reasons.includes("accessnotconfigured") || /has not been used|is disabled/i.test(body.error?.message || "");
      throw new GmailError(disabled ? "api_disabled" : response.status === 403 ? "permission_required" : response.status === 401 ? "connect" : "unavailable", response.status);
    }
    return body as T;
  };
  const query = new URLSearchParams({ labelIds: "INBOX", maxResults: String(limit), fields: "messages(id),nextPageToken" });
  if (pageToken) query.set("pageToken", pageToken);
  const [profile, inbox, list] = await Promise.all([
    get<{ emailAddress: string }>("profile?fields=emailAddress"),
    get<{ messagesTotal: number; messagesUnread: number }>("labels/INBOX?fields=messagesTotal,messagesUnread"),
    get<{ messages?: Array<{ id: string }>; nextPageToken?: string }>(`messages?${query}`),
  ]);
  const ids = (list.messages || []).slice(0, limit);
  const messages: GmailMessage[] = [];
  // Bounded concurrency keeps a mailbox refresh within Google's request quota.
  for (let offset = 0; offset < ids.length; offset += 4) {
    const batch = await Promise.all(ids.slice(offset, offset + 4).map(async ({ id }) => {
      // Full format supplies the snippet; the field mask excludes message bodies and attachments.
      const fields = new URLSearchParams({ format: "full", fields: "id,threadId,labelIds,snippet,internalDate,payload(headers)" });
      try { return gmailMessage(await get<ApiMessage>(`messages/${encodeURIComponent(id)}?${fields}`), profile.emailAddress); }
      catch (error) {
        if (error instanceof GmailError && error.status === 404) return null;
        throw error;
      }
    }));
    messages.push(...batch.filter((message): message is GmailMessage => message !== null));
  }
  return { state: "connected", messages, emailAddress: profile.emailAddress, total: inbox.messagesTotal, unread: inbox.messagesUnread, nextPageToken: list.nextPageToken, fetchedAt: new Date().toISOString() };
}

export async function handleGmailApi(request: Request, env: GoogleTasksEnv): Promise<Response> {
  const json = (body: GmailInboxResponse, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  if (request.method !== "GET") return new Response(null, { status: 405, headers: { Allow: "GET" } });
  const url = new URL(request.url);
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (!local && !request.headers.get("oai-authenticated-user-id")) return json({ state: "sign_in_required", messages: [] }, 401);
  if (!env.DB || !isGoogleTasksConfigured(env)) return json({ state: "unconfigured", messages: [] });
  const pageToken = url.searchParams.get("pageToken") || "";
  if (pageToken.length > 2048) return json({ state: "unavailable", messages: [] }, 400);
  try {
    const token = await getGoogleAccessToken(env.DB, env, AbortSignal.timeout(15000));
    return json(await readGmailInbox(token, url.searchParams.get("limit") === "5" ? 5 : 20, pageToken));
  } catch (error) {
    if (error instanceof GmailError) return json({ state: error.state, messages: [] }, error.state === "unavailable" ? 503 : 200);
    const status = error && typeof error === "object" && "status" in error ? Number(error.status) : 0;
    if (status === 401 || status === 400) return json({ state: "connect", messages: [] });
    return json({ state: "unavailable", messages: [] }, 503);
  }
}
