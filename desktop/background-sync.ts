type Fetch = (path: string, init?: RequestInit) => Promise<Response>;

export type BackgroundSyncOptions = {
  /** Calls the app's own API; the app passes the in-process Worker so no socket is involved. */
  fetch: Fetch;
  origin: string;
  /** Google sync sends the whole workspace, so it only runs when no window holds a copy of it. */
  isWindowOpen: () => boolean;
  /** Called after each Parro check with the latest messages and the unread count. */
  onParro: (messages: InboxMessage[], unread: number) => void;
  /** Called after each Gmail check with the latest inbox messages. */
  onGmail: (messages: InboxMessage[]) => void;
  /** Google Tasks and Calendar sync at most this often; Parro and Gmail are checked on every pass. */
  googleEveryMs?: number;
  /** A pass that takes longer than this is abandoned, so one hanging request never stops all later passes. */
  passTimeoutMs?: number;
  /** Called with a short description when a step fails; the next pass tries again. */
  onError?: (message: string) => void;
};

type Workspace = { items: unknown[]; revision: number };
export type InboxMessage = { id: string; unread: boolean; title?: string; subject?: string; sender?: string; roomName?: string; url?: string };
const WRITER = { protocolVersion: 2, capabilities: ["trash"] };

const describe = (error: unknown) => error instanceof Error ? error.message : String(error);

const withTimeout = <T>(promise: Promise<T>, ms: number) => {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`gestopt na ${Math.round(ms / 1000)} seconden`)), ms); });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
};

/** Runs the page-driven syncs from the app itself, so Parro and Google stay current while the window is closed. */
export const createBackgroundSync = ({ fetch, origin, isWindowOpen, onParro, onGmail, onError = () => {}, googleEveryMs = 0, passTimeoutMs = 5 * 60_000 }: BackgroundSyncOptions) => {
  let lastGoogle = 0;
  let running = false;

  // Every response body is read to the end, so nothing stays buffered.
  const request = async <T>(path: string, init: RequestInit = {}): Promise<T | null> => {
    const response = await fetch(path, { ...init, headers: { Origin: origin, "Content-Type": "application/json", ...init.headers } });
    const text = await response.text();
    return response.ok && text ? JSON.parse(text) as T : null;
  };

  const syncParro = async () => {
    const current = await request<{ connectionState?: string }>("/api/parro/messages?limit=1");
    if (current?.connectionState !== "connected") return;
    // A busy answer means another sync is fetching already; anything else that fails is worth a line in the log.
    const refresh = await fetch("/api/parro/refresh", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" } });
    const outcome = await refresh.text();
    if (!refresh.ok && refresh.status !== 409) onError(`Parro vernieuwen mislukt (${refresh.status}): ${(() => { try { return String(JSON.parse(outcome).error ?? outcome); } catch { return outcome; } })().slice(0, 200)}`);
    const refreshed = await request<{ unread?: number; messages?: InboxMessage[] }>("/api/parro/messages?limit=20");
    onParro(refreshed?.messages ?? [], Number(refreshed?.unread ?? 0));
  };

  const checkGmail = async () => {
    const inbox = await request<{ state?: string; messages?: InboxMessage[] }>("/api/gmail/inbox?limit=5");
    if (inbox?.state === "connected") onGmail(inbox.messages ?? []);
  };

  const syncGoogle = async () => {
    for (const service of ["google-tasks", "google-calendar"]) {
      const status = await request<{ connected?: boolean; needsReconnect?: boolean }>(`/api/${service}/status`);
      if (!status?.connected || status.needsReconnect) continue;
      // Reload the workspace before every service, because each sync saves a new revision.
      const workspace = await request<Workspace>("/api/workspace");
      if (!workspace) return;
      await request(`/api/${service}/sync`, { method: "POST", body: JSON.stringify({ items: workspace.items, baseRevision: workspace.revision, ...WRITER }) });
    }
  };

  const pass = async () => {
    await syncParro().catch((error: unknown) => onError(`Parro-sync mislukt: ${describe(error)}`));
    await checkGmail().catch((error: unknown) => onError(`Gmail controleren mislukt: ${describe(error)}`));
    if (!isWindowOpen() && Date.now() - lastGoogle >= googleEveryMs) {
      lastGoogle = Date.now();
      await syncGoogle().catch((error: unknown) => onError(`Google-sync mislukt: ${describe(error)}`));
    }
  };

  /** One pass at a time. Never throws: a failed or stuck pass is simply tried again later. */
  const run = async () => {
    if (running) return;
    running = true;
    try {
      await withTimeout(pass(), passTimeoutMs).catch((error: unknown) => onError(`Achtergrond-sync ${describe(error)}`));
    } finally {
      running = false;
    }
  };

  return { run };
};
