import type { GoogleTasksDatabase, GoogleTasksStatement } from "./google-tasks.ts";

export class GoogleSyncSafetyError extends Error {
  status = 409;
  code: "sync_busy" | "sync_uncertain";
  constructor(code: "sync_busy" | "sync_uncertain") {
    super(code === "sync_busy"
      ? "Er loopt al een Google-sync. Wacht tot deze klaar is en probeer opnieuw."
      : "Google heeft een eerdere aanmaak niet bevestigd. Sync is veilig gepauzeerd om dubbele items te voorkomen. Controleer het item in Google voordat je opnieuw aanmaakt.");
    this.code = code;
  }
}

export type SyncGuard = { check: () => Promise<void> };
const LEASE_MS = 5 * 60 * 1000;

export async function withGoogleSyncLock<T>(database: GoogleTasksDatabase, action: (guard: SyncGuard) => Promise<T>): Promise<T> {
  const owner = crypto.randomUUID();
  const now = Date.now();
  const acquired = await database.prepare(`INSERT INTO google_sync_lease (id, owner, expires_at) VALUES ('primary', ?, ?)
ON CONFLICT(id) DO UPDATE SET owner = excluded.owner, expires_at = excluded.expires_at
WHERE google_sync_lease.expires_at <= ?`).bind(owner, now + LEASE_MS, now).run();
  if (!acquired.meta?.changes) throw new GoogleSyncSafetyError("sync_busy");
  const guard: SyncGuard = { check: async () => {
    const now = Date.now();
    const result = await database.prepare(`UPDATE google_sync_lease SET expires_at = ? WHERE id = 'primary' AND owner = ? AND expires_at > ?`).bind(now + LEASE_MS, owner, now).run();
    if (!result.meta?.changes) throw new GoogleSyncSafetyError("sync_busy");
  } };
  try { return await action(guard); }
  finally { await database.prepare("DELETE FROM google_sync_lease WHERE id = 'primary' AND owner = ?").bind(owner).run(); }
}

export type CreateReceipt = { operation_key: string; local_row_id: string; container_id: string; replaces_id: string; payload_json: string; observed_ids_json: string; result_json: string | null };
export const readCreateReceipts = async (database: GoogleTasksDatabase, service: "tasks" | "calendar") =>
  (await database.prepare("SELECT operation_key, local_row_id, container_id, replaces_id, payload_json, observed_ids_json, result_json FROM google_sync_creates WHERE service = ? ORDER BY rowid").bind(service).all<CreateReceipt>()).results;

export async function createRemoteOnce<T extends { id: string }>(options: {
  database: GoogleTasksDatabase;
  guard: SyncGuard;
  service: "tasks" | "calendar";
  localRowId: string;
  containerId: string;
  replacesId?: string;
  payload: unknown;
  observedIds: string[];
  create: () => Promise<T>;
  mapping: (result: T) => GoogleTasksStatement;
}): Promise<T> {
  const { database, guard, service, localRowId, containerId, create, mapping } = options;
  const replacesId = options.replacesId || "";
  const key = JSON.stringify([service, localRowId, replacesId]);
  await guard.check();
  const claimed = await database.prepare(`INSERT OR IGNORE INTO google_sync_creates (operation_key, service, local_row_id, container_id, replaces_id, payload_json, observed_ids_json)
VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(key, service, localRowId, containerId, replacesId, JSON.stringify(options.payload), JSON.stringify(options.observedIds)).run();
  if (!claimed.meta?.changes) {
    const previous = await database.prepare("SELECT result_json, container_id FROM google_sync_creates WHERE operation_key = ?").bind(key).first<{ result_json: string | null; container_id: string }>();
    if (!previous?.result_json || previous.container_id !== containerId) throw new GoogleSyncSafetyError("sync_uncertain");
    return JSON.parse(previous.result_json) as T;
  }
  // Never retry an ambiguous POST. The durable pending row intentionally remains
  // if the response is lost, the Worker stops, or the acknowledgement cannot save.
  let result: T;
  try { result = await create(); }
  catch (error) {
    const status = error && typeof error === "object" && "status" in error ? Number(error.status) : 0;
    // An explicit rejection did not create anything. Timeouts and ambiguous
    // server errors retain the receipt and require investigation, never a retry.
    if (status >= 400 && status < 500 && status !== 408 && status !== 409) {
      await database.prepare("DELETE FROM google_sync_creates WHERE operation_key = ? AND result_json IS NULL").bind(key).run();
      throw error;
    }
    throw new GoogleSyncSafetyError("sync_uncertain");
  }
  if (!result?.id) throw new GoogleSyncSafetyError("sync_uncertain");
  await database.batch([
    mapping(result),
    database.prepare("UPDATE google_sync_creates SET result_json = ? WHERE operation_key = ?").bind(JSON.stringify(result), key),
  ]);
  return result;
}
