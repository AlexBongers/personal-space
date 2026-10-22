// Parro protocol adapted from anneschuth/parro-cli (MIT), src/parro/client.py.
// Credentials are only used for this login; stored tokens are encrypted by parro.ts.
const IDP = "https://inloggen.parnassys.net";
const API = "https://rest-v2.parro.com/rest/v2";
const CLIENT = "W52dbSBQuFp-LF4Xch1r";
const REDIRECT = "parro://oauth2";
// Match the known-working Parro CLI request profile. The IDP serves a page to
// generic clients, but its credential POST is sensitive to the expected client
// headers, so keep the login and token exchange form headers explicit as well.
const USER_AGENT = "Mozilla/5.0 (Macintosh) Parro-CLI/0.1";
export type ParroTokens = { access_token: string; refresh_token: string };
export class ParroError extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 502, code = "parro_error") { super(message); this.status = status; this.code = code; }
}
const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const base64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const decodeHtml = (value: string) => value.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const attributes = (tag: string) => Object.fromEntries([...tag.matchAll(/([\w-]+)\s*=\s*["']([^"']*)["']/g)].map((match) => [match[1].toLowerCase(), decodeHtml(match[2])]));
const textContent = (value: string) => decodeHtml(value.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const loginFailure = (html: string) => {
  const visible = textContent(html.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, " ")).toLowerCase();
  if (/geblokkeerd|account.{0,30}(?:inactief|inactive|locked|blocked)|(?:inactief|inactive|locked|blocked).{0,30}account/.test(visible)) {
    return new ParroError("Parro meldt dat het account geblokkeerd of inactief is. Controleer dit in Parro of vraag de school om hulp.", 401, "account_inactive");
  }
  if (/two[ -]?factor|twee[ -]?staps|verificatiecode|verification code|authenticator|eenmalige code|sms.code|security code/.test(visible)) {
    return new ParroError("Parro vraagt om een extra verificatiestap. Deze koppeling ondersteunt alleen e-mail en wachtwoord; rond de controle eerst in Parro af.", 401, "verification_required");
  }
  if (/<input\b[^>]*type=["']password["']/i.test(html)) {
    return new ParroError("Parro heeft de aanmelding afgewezen. Controleer het e-mailadres en wachtwoord waarmee je rechtstreeks op talk.parro.com kunt inloggen.", 401, "credentials_rejected");
  }
  return new ParroError("Parro toonde na aanmelden een extra keuze of controle die Personal Space niet herkent. Controleer of je Parro-account e-mail en wachtwoord gebruikt.", 401, "login_step_unrecognized");
};
type AccountChoice = { url: string; focusId: string; name: string; role: string };
const accountChoices = (html: string): AccountChoice[] => [...html.matchAll(/"u":"([^"\n]*accountKeuze-accounts-account-\d+)","c":"([^"\n]+)"/g)].map((entry) => {
  const escaped = entry[2].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const block = html.match(new RegExp(`<li[^>]*id=["']${escaped}["'][^>]*>([\\s\\S]*?)</li>`, "i"))?.[1] || "";
  const name = block.match(/account-list__name["'][^>]*>([\s\S]*?)<\/span>\s*<\/span>/i)?.[1] || "";
  const role = block.match(/account-list__role["'][^>]*>([\s\S]*?)<\/span>\s*<\/span>/i)?.[1] || "";
  return { url: decodeHtml(entry[1]), focusId: entry[2], name: textContent(name), role: textContent(role) };
});
export const limitedText = async (response: Pick<Response, "body">, limit = 2_000_000) => {
  if (!response.body) return "";
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.byteLength; if (size > limit) { await reader.cancel(); throw new ParroError("Het Parro-antwoord is te groot."); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder().decode(bytes);
};
type LoginStage = "authorize" | "credential_submit" | "redirect" | "account_choice" | "application_choice" | "token_exchange";
const loginStageName: Record<LoginStage, string> = {
  authorize: "starten van de Parro-aanmelding",
  credential_submit: "verwerken van de Parro-inlog",
  redirect: "openen van de volgende Parro-inlogstap",
  account_choice: "verwerken van de Parro-accountkeuze",
  application_choice: "openen van Parro",
  token_exchange: "afronden van de Parro-inlog",
};
const operationSignal = (signal: AbortSignal | undefined, stage: LoginStage) => {
  if (signal) return signal;
  try { return AbortSignal.timeout(90_000); }
  catch { throw new ParroError("De Parro-aanmelding kon niet veilig worden gestart.", 502, `parro_${stage}_deadline_setup_failed`); }
};
const upstreamFailure = (stage: LoginStage, error: unknown, signal: AbortSignal, phase: "network" | "response_read" = "network") => {
  const errorName = error instanceof Error ? error.name : "";
  const timedOut = signal.aborted || errorName === "AbortError" || errorName === "TimeoutError";
  const message = timedOut
    ? `Het ${loginStageName[stage]} duurde te lang. Probeer opnieuw.`
    : `Het ${loginStageName[stage]} mislukte door een verbindingsfout. Probeer opnieuw.`;
  return new ParroError(message, 502, `parro_${stage}_${timedOut ? "timeout" : `${phase}_failed`}`);
};
const invalidLoginUrl = (stage: LoginStage) => new ParroError("Parro gaf een ongeldige inlogverwijzing terug.", 502, `parro_${stage}_url_invalid`);
const invalidLoginHeaders = (stage: LoginStage) => new ParroError("Parro gaf ongeldige inlogheaders terug.", 502, `parro_${stage}_headers_invalid`);
const invalidLoginResponseHeaders = (stage: LoginStage) => new ParroError("Parro gaf ongeldige antwoordheaders terug.", 502, `parro_${stage}_response_headers_invalid`);
const resolveLoginUrl = (value: string, base: string, stage: LoginStage) => {
  try { return new URL(value, base); } catch { throw invalidLoginUrl(stage); }
};
const readLoginResponse = async (response: Response, stage: LoginStage, signal: AbortSignal) => {
  try { return await limitedText(response); }
  catch (error) {
    if (error instanceof ParroError) throw new ParroError("Parro gaf een onleesbaar inlogantwoord terug.", 502, `parro_${stage}_response_invalid`);
    throw upstreamFailure(stage, error, signal, "response_read");
  }
};
type MessageEndpoint = "groups" | "chatrooms" | "announcements" | "chat_messages";
const messageEndpointName: Record<MessageEndpoint, string> = {
  groups: "Parro-groepen",
  chatrooms: "Parro-chatrooms",
  announcements: "Parro-mededelingen",
  chat_messages: "Parro-chatberichten",
};
const messageEndpointFailure = (endpoint: MessageEndpoint, error: unknown, signal: AbortSignal, phase: "network" | "response_read" = "network") => {
  const errorName = error instanceof Error ? error.name : "";
  const timedOut = signal.aborted || errorName === "AbortError" || errorName === "TimeoutError";
  const message = timedOut
    ? `Het ophalen van ${messageEndpointName[endpoint]} duurde te lang. Probeer opnieuw.`
    : `Het ophalen van ${messageEndpointName[endpoint]} mislukte door een verbindingsfout. Probeer opnieuw.`;
  return new ParroError(message, 502, `parro_${endpoint}_${timedOut ? "timeout" : `${phase}_failed`}`);
};
const getJson = async (response: Response, endpoint: MessageEndpoint, signal: AbortSignal): Promise<unknown> => {
  if (!response.ok) {
    if (response.status === 401) throw new ParroError("De Parro-sessie is verlopen. Verbind Parro opnieuw.", 401, `parro_${endpoint}_unauthorized`);
    if (response.status === 403) throw new ParroError(`Parro geeft dit account geen toegang tot ${messageEndpointName[endpoint]}. De aanmelding blijft behouden.`, 502, `parro_${endpoint}_forbidden`);
    throw new ParroError(`Parro kon ${messageEndpointName[endpoint]} niet ophalen (HTTP ${response.status}). Probeer opnieuw.`, 502, `parro_${endpoint}_http_error`);
  }
  let body: string;
  try { body = await limitedText(response); }
  catch (error) {
    if (error instanceof ParroError) throw new ParroError(`Parro gaf een onvolledig antwoord voor ${messageEndpointName[endpoint]}.`, 502, `parro_${endpoint}_response_invalid`);
    throw messageEndpointFailure(endpoint, error, signal, "response_read");
  }
  try { return JSON.parse(body); }
  catch { throw new ParroError(`Parro gaf een ongeldig antwoord voor ${messageEndpointName[endpoint]}.`, 502, `parro_${endpoint}_invalid_json`); }
};
const exchange = async (parameters: Record<string, string>, previousRefresh = "", signal?: AbortSignal): Promise<ParroTokens> => {
  const exchangeSignal = operationSignal(signal, "token_exchange");
  let headers: Headers;
  try { headers = new Headers({ "User-Agent": USER_AGENT, Accept: "*/*", "Content-Type": "application/x-www-form-urlencoded" }); }
  catch { throw invalidLoginHeaders("token_exchange"); }
  let requestSignal: AbortSignal;
  try { requestSignal = AbortSignal.any([exchangeSignal, AbortSignal.timeout(20_000)]); }
  catch (error) { throw upstreamFailure("token_exchange", error, exchangeSignal); }
  let response: Response;
  try {
    // Manual mode keeps the token endpoint from redirecting, while allowing a
    // safe, stage-specific error instead of fetch's opaque redirect TypeError.
    response = await fetch(`${IDP}/idp/oauth2/token`, { method: "POST", redirect: "manual", signal: requestSignal, headers, body: new URLSearchParams({ client_id: CLIENT, ...parameters }) });
  } catch (error) { throw upstreamFailure("token_exchange", error, requestSignal); }
  if (response.status >= 300 && response.status < 400) throw new ParroError("Parro stuurde het afronden van de inlog door. Probeer opnieuw.", 502, "parro_token_exchange_redirect_rejected");
  if (response.status === 400 || response.status === 401) {
    if (parameters.grant_type === "refresh_token") throw new ParroError("De Parro-sessie is verlopen. Verbind Parro opnieuw.", 401, "parro_refresh_rejected");
    throw new ParroError("Parro heeft de inlogbevestiging niet geaccepteerd. Probeer opnieuw in te loggen.", 401, "parro_token_exchange_rejected");
  }
  if (!response.ok) throw new ParroError(`Parro kon de inlog niet afronden (HTTP ${response.status}). Probeer opnieuw.`, 502, "parro_token_exchange_http_error");
  let responseText: string;
  try { responseText = await limitedText(response); }
  catch (error) {
    if (error instanceof ParroError) throw new ParroError("Parro gaf een onleesbaar antwoord bij het afronden van de inlog.", 502, "parro_token_exchange_response_invalid");
    throw upstreamFailure("token_exchange", error, requestSignal, "response_read");
  }
  let value: unknown;
  try { value = JSON.parse(responseText); }
  catch { throw new ParroError("Parro gaf een ongeldig antwoord bij het afronden van de inlog.", 502, "parro_token_exchange_invalid_json"); }
  if (!record(value) || typeof value.access_token !== "string" || !value.access_token || !(typeof value.refresh_token === "string" && value.refresh_token || previousRefresh)) throw new ParroError("Parro gaf geen geldige toegangssessie.", 502, "parro_token_exchange_invalid_tokens");
  return { access_token: value.access_token, refresh_token: typeof value.refresh_token === "string" && value.refresh_token || previousRefresh };
};
export const refreshParroTokens = (token: string, signal?: AbortSignal) => exchange({ grant_type: "refresh_token", refresh_token: token }, token, signal);

export async function loginParro(username: string, password: string, account = "", signal?: AbortSignal): Promise<ParroTokens> {
  const loginSignal = operationSignal(signal, "authorize");
  let verifier: string; let challenge: string; let state: string;
  try {
    verifier = base64(crypto.getRandomValues(new Uint8Array(64)));
    challenge = base64(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
    state = base64(crypto.getRandomValues(new Uint8Array(32)));
  } catch { throw new ParroError("De beveiligde Parro-inlog kon niet worden voorbereid.", 502, "parro_pkce_setup_failed"); }
  const cookies = new Map<string, string>();
  const request = async (url: string | URL, stage: LoginStage, init: RequestInit = {}) => {
    let target: URL;
    try { target = url instanceof URL ? url : new URL(url); } catch { throw invalidLoginUrl(stage); }
    if (target.origin !== IDP) throw new ParroError("Parro verwees naar een onbekende inlogpagina.", 502, `parro_${stage}_untrusted_url`);
    const cookieHeader = [...cookies].map(([name, value]) => `${name}=${value}`).join("; ");
    let headers: Headers;
    try {
      headers = new Headers({ "User-Agent": USER_AGENT, Accept: "*/*", ...(cookieHeader ? { Cookie: cookieHeader } : {}) });
      new Headers(init.headers).forEach((value, name) => headers.set(name, value));
    } catch { throw invalidLoginHeaders(stage); }
    let requestSignal: AbortSignal;
    try { requestSignal = AbortSignal.any([loginSignal, AbortSignal.timeout(15_000)]); }
    catch (error) { throw upstreamFailure(stage, error, loginSignal); }
    let response: Response;
    try { response = await fetch(target, { ...init, redirect: "manual", signal: requestSignal, headers }); }
    catch (error) { throw upstreamFailure(stage, error, requestSignal); }
    let setCookies: string[];
    try { setCookies = response.headers.getSetCookie(); }
    catch { throw invalidLoginResponseHeaders(stage); }
    for (const cookie of setCookies) {
      try {
        const pair = cookie.split(";", 1)[0]; const separator = pair.indexOf("=");
        if (separator > 0) cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
      } catch { throw invalidLoginResponseHeaders(stage); }
    }
    return { response, url: target.toString(), stage };
  };
  const params = new URLSearchParams({ client_id: CLIENT, redirect_uri: REDIRECT, response_type: "code", scope: "openid", state, code_challenge: challenge, code_challenge_method: "S256" });
  let current = await request(`${IDP}/idp/oauth2/authorize?${params}`, "authorize");
  let submitted = false;
  for (let step = 0; step < 20; step++) {
    const response = current.response;
    const location = response.headers.get("Location");
    if (response.status >= 300 && response.status < 400 && location) {
      const next = resolveLoginUrl(location, current.url, current.stage);
      if (next.protocol === "parro:") {
        const code = next.searchParams.get("code");
        if (next.searchParams.has("error")) {
          const oauthError = next.searchParams.get("error");
          if (oauthError === "access_denied") throw new ParroError("Parro heeft de aanmelding geweigerd. Controleer of je account toegang heeft en probeer opnieuw.", 401, "oauth_access_denied");
          if (oauthError === "login_required" || oauthError === "interaction_required") throw new ParroError("Parro vereist dat je opnieuw inlogt of een extra controle afrondt. Log eerst in op Parro en probeer opnieuw.", 401, "oauth_login_required");
          if (oauthError === "temporarily_unavailable" || oauthError === "server_error") throw new ParroError("De Parro-inlogdienst is tijdelijk niet beschikbaar. Probeer het later opnieuw.", 502, "oauth_temporarily_unavailable");
          throw new ParroError("Parro heeft de aanmelding niet afgerond. Probeer opnieuw.", 401, "oauth_login_failed");
        }
        // Parro CLI accepts any `parro:` callback containing a code and does
        // not validate host or state. PKCE still binds the exchange to this
        // login attempt; a code is mandatory and OAuth error callbacks above
        // are never exchanged.
        if (!code) throw new ParroError("Parro rondde de aanmelding af zonder autorisatiecode. Controleer of de login is voltooid en probeer opnieuw.", 401, "oauth_callback_missing_code");
        return exchange({ grant_type: "authorization_code", code, redirect_uri: REDIRECT, code_verifier: verifier }, "", loginSignal);
      }
      current = await request(next, "redirect"); continue;
    }
    if (!response.ok) throw new ParroError(`Parro kon het ${loginStageName[current.stage]} niet voltooien (HTTP ${response.status}). Probeer opnieuw.`, response.status === 401 || response.status === 403 ? 401 : 502, `parro_${current.stage}_http_error`);
    const html = await readLoginResponse(response, current.stage, loginSignal);
    if (submitted && html.includes("accountKeuze")) {
      const choices = accountChoices(html);
      if (!choices.length) throw new ParroError("De Parro-accountkeuze is gewijzigd; verbinden is tijdelijk niet mogelijk.");
      const wanted = account.toLowerCase();
      const chosen = account ? choices.find((choice) => choice.name.toLowerCase().includes(wanted) || choice.role.toLowerCase().includes(wanted)) : choices[0];
      if (!chosen) {
        const available = choices.map((choice) => [choice.name, choice.role].filter(Boolean).join(" (") + (choice.name && choice.role ? ")" : "")).filter(Boolean).join(", ");
        throw new ParroError(`Parro-account '${account}' is niet gevonden.${available ? ` Beschikbaar: ${available}.` : ""}`, 400);
      }
      const choiceUrl = resolveLoginUrl(chosen.url, current.url, "account_choice");
      const result = await request(choiceUrl, "account_choice", { headers: { "Wicket-Ajax": "true", "Wicket-Ajax-BaseURL": html.match(/Wicket\.Ajax\.baseUrl="([^"]*)"/)?.[1] || new URL(current.url).pathname, "Wicket-FocusedElementId": chosen.focusId, "X-Requested-With": "XMLHttpRequest" } });
      let choiceBody = "";
      if (!result.response.headers.get("Ajax-Location")) choiceBody = await readLoginResponse(result.response, "account_choice", loginSignal);
      const target = result.response.headers.get("Ajax-Location") || choiceBody.match(/<redirect><!\[CDATA\[(.*?)\]\]><\/redirect>/)?.[1];
      if (!target) throw new ParroError("Parro kon het gekozen account niet openen.");
      const targetUrl = resolveLoginUrl(target, result.url, "account_choice");
      try { current = { response: new Response(null, { status: 302, headers: { Location: targetUrl.toString() } }), url: result.url, stage: "account_choice" }; }
      catch { throw invalidLoginResponseHeaders("account_choice"); }
      continue;
    }
    if (submitted && new URL(current.url).pathname.includes("kies_applicatie")) {
      const link = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].find((entry) => /Parro/i.test(entry[2].replace(/<[^>]+>/g, " ")));
      if (link) { current = await request(resolveLoginUrl(decodeHtml(link[1]), current.url, "application_choice"), "application_choice"); continue; }
    }
    if (submitted) throw loginFailure(html);
    const form = html.match(/<form\b[^>]*>/i)?.[0];
    const action = form && attributes(form).action;
    if (!action) throw new ParroError("Het Parro-inlogformulier is gewijzigd; verbinden is tijdelijk niet mogelijk.");
    const fields = new URLSearchParams(); let userField = "emailadres", passwordField = "wachtwoord";
    for (const input of html.match(/<input\b[^>]*>/gi) || []) {
      const attr = attributes(input); if (!attr.name) continue;
      if (attr.type === "hidden") fields.set(attr.name, attr.value || "");
      if (attr.type === "password") passwordField = attr.name;
      if (["text", "email"].includes(attr.type || "text")) userField = attr.name;
    }
    fields.set(userField, username); fields.set(passwordField, password); fields.set("aanmelden", "x");
    current = await request(resolveLoginUrl(action, current.url, "credential_submit"), "credential_submit", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: fields }); submitted = true;
  }
  throw new ParroError("Parro inloggen duurde te lang. Probeer opnieuw.");
}

export async function fetchParroMessages(token: string, syncedAt: string, signal?: AbortSignal) {
  let operationSignal: AbortSignal;
  try { operationSignal = signal || AbortSignal.timeout(90_000); }
  catch { throw new ParroError("Parro-synchronisatie kon niet veilig worden gestart.", 502, "parro_message_sync_deadline_setup_failed"); }
  const items = async (path: string, endpoint: MessageEndpoint): Promise<Record<string, unknown>[]> => {
    let requestSignal: AbortSignal;
    try { requestSignal = AbortSignal.any([operationSignal, AbortSignal.timeout(20_000)]); }
    catch (error) { throw messageEndpointFailure(endpoint, error, operationSignal); }
    let response: Response;
    try {
      // Match parro-cli's ordinary GET: no Range and no custom login User-Agent.
      // Manual redirects preserve the CLI's no-follow behavior and let us return
      // a safe endpoint-specific error instead of fetch's opaque redirect error.
      response = await fetch(`${API}${path}`, { redirect: "manual", signal: requestSignal, headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
    } catch (error) { throw messageEndpointFailure(endpoint, error, requestSignal); }
    if (response.status >= 300 && response.status < 400) throw new ParroError(`Parro stuurde het ophalen van ${messageEndpointName[endpoint]} door. Probeer opnieuw.`, 502, `parro_${endpoint}_redirect_rejected`);
    const value = await getJson(response, endpoint, requestSignal); const list = record(value) ? value.items : value;
    if (!Array.isArray(list) || list.some((item) => !record(item))) throw new ParroError("Parro gaf onvolledige berichten; de vorige synchronisatie blijft bewaard.");
    return list;
  };
  const id = (value: Record<string, unknown>) => {
    // Parro's HAL links include related identities and organisations. Only the
    // self relation identifies the resource; link order has no meaning.
    const links = Array.isArray(value.links) ? value.links.filter(record) : [];
    const self = links.find((link) => link.rel === "self");
    if (self && (typeof self.id === "string" || typeof self.id === "number")) return String(self.id);
    const direct = value.id ?? value._id ?? value.linkId;
    if (typeof direct === "string" || typeof direct === "number") return String(direct);
    throw new ParroError("Een Parro-bericht heeft geen eigen identificatie; de vorige berichten blijven bewaard.", 502, "parro_resource_identifier_missing");
  };
  const name = (value: unknown) => typeof value === "string" ? value : record(value) ? String(value.displayName || value.name || value.fullName || "") : "";
  const date = (value: Record<string, unknown>) => String(value.sortDate || value.lastModifiedAt || value.createdAt || syncedAt);
  const stableId = async (kind: string, value: string) => `${kind}:${Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))).map((byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 32)}`;
  const attachments = (value: Record<string, unknown>) => {
    const names: string[] = []; let count = 0;
    for (const [key, child] of Object.entries(value)) {
      if (["attachments", "files", "documents", "media"].includes(key.toLowerCase())) {
        for (const file of Array.isArray(child) ? child : child ? [child] : []) { count++; const label = typeof file === "string" ? file.split("?")[0].split("/").pop() : record(file) ? file.fileName || file.filename || file.name || file.title : ""; if (typeof label === "string" && names.length < 12) names.push(label); }
      }
    }
    return { attachmentCount: count, attachmentNames: names };
  };
  const [groups, rooms] = await Promise.all([items("/group?dtype=identity.RHomeGroup", "groups"), items("/chatroom", "chatrooms")]);
  if (groups.length > 20) throw new ParroError("Dit Parro-account heeft meer dan 20 groepen; de vorige berichten blijven bewaard.");
  const announcements: Record<string, unknown>[] = [];
  for (let start = 0; start < groups.length; start += 3) {
    const batch = await Promise.all(groups.slice(start, start + 3).map(async (group) => (await items(`/event?dtype=event.RAnnouncementEvent&group=${encodeURIComponent(id(group))}`, "announcements")).map((entry) => ({ ...entry, _group_name: name(group) }))));
    announcements.push(...batch.flat());
  }
  const unique = [...new Map(announcements.map((entry) => [id(entry), entry])).values()].sort((a, b) => date(b).localeCompare(date(a))).slice(0, 20);
  const messages = await Promise.all(unique.map(async (entry) => ({ id: await stableId("announcement", id(entry)), kind: "announcement", title: entry.title || "Parro-mededeling", body: entry.contents || entry.text || "", sender: name(entry.owner), roomName: entry._group_name, publishedAt: date(entry), unread: entry.read !== true, unreadCount: entry.read === true ? 0 : 1, externalUrl: entry.url || entry.link || "", ...attachments(entry) })));
  const unreadRooms = rooms.filter((room) => Number(room.unreadCount) > 0).slice(0, 30);
  for (let start = 0; start < unreadRooms.length; start += 3) {
    await Promise.all(unreadRooms.slice(start, start + 3).map(async (room) => {
    const latest = (await items(`/chatroom/${encodeURIComponent(id(room))}/chatmessage`, "chat_messages")).sort((a, b) => date(b).localeCompare(date(a)))[0] || {};
    messages.push({ id: await stableId("chatroom", id(room)), kind: "chatroom", title: room.title || room.subject || room.name || "Parro-chatroom", body: latest.text || latest.contents || "", sender: name(latest.identity) || name(latest.sender), roomName: name(room), publishedAt: Object.keys(latest).length ? date(latest) : date(room), unread: true, unreadCount: Number(room.unreadCount), externalUrl: "", ...attachments(latest) });
    }));
  }
  return messages;
}
