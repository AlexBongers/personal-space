type Fetch = typeof fetch;

export type BackgroundSyncOptions = {
  baseUrl: string;
  /** Google sync sends the whole workspace, so it only runs when no window holds a copy of it. */
  isWindowOpen: () => boolean;
  /** Called after each Parro check with the unread count; `increased` is true when new messages arrived. */
  onParroUnread: (unread: number, increased: boolean) => void;
  fetchImpl?: Fetch;
};

type Workspace = { items: unknown[]; revision: number };
const WRITER = { protocolVersion: 2, capabilities: ["trash"] };

/** Runs the page-driven syncs from the app itself, so Parro and Google stay current while the window is closed. */
export const createBackgroundSync = ({ baseUrl, isWindowOpen, onParroUnread, fetchImpl = fetch }: BackgroundSyncOptions) => {
  let lastUnread: number | null = null;
  let running = false;

  const call = (path: string, init: RequestInit = {}) => fetchImpl(`${baseUrl}${path}`, {
    ...init,
    // The Worker only accepts same-origin writes.
    headers: { Origin: baseUrl, "Content-Type": "application/json", ...init.headers },
  });
  const json = async <T>(path: string, init?: RequestInit) => {
    const response = await call(path, init);
    return response.ok ? await response.json() as T : null;
  };

  const syncParro = async () => {
    const current = await json<{ connectionState?: string }>("/api/parro/messages?limit=1");
    if (current?.connectionState !== "connected") return;
    await call("/api/parro/refresh", { method: "POST" });
    const refreshed = await json<{ unread?: number }>("/api/parro/messages?limit=1");
    const unread = Number(refreshed?.unread ?? 0);
    onParroUnread(unread, lastUnread !== null && unread > lastUnread);
    lastUnread = unread;
  };

  const syncGoogle = async () => {
    for (const service of ["google-tasks", "google-calendar"]) {
      const status = await json<{ connected?: boolean; needsReconnect?: boolean }>(`/api/${service}/status`);
      if (!status?.connected || status.needsReconnect) continue;
      // Reload the workspace before every service, because each sync saves a new revision.
      const workspace = await json<Workspace>("/api/workspace");
      if (!workspace) return;
      await call(`/api/${service}/sync`, { method: "POST", body: JSON.stringify({ items: workspace.items, baseRevision: workspace.revision, ...WRITER }) });
    }
  };

  /** One pass. Never throws: a failed pass is simply tried again on the next interval. */
  const run = async () => {
    if (running) return;
    running = true;
    try {
      await syncParro().catch(() => {});
      if (!isWindowOpen()) await syncGoogle().catch(() => {});
    } finally {
      running = false;
    }
  };

  return { run };
};
