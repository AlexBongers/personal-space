/** Track the last successful sync, independently of the age of individual messages. */
export function parroSnapshotStatus(syncedAt: string | undefined, now = Date.now()) {
  const timestamp = syncedAt ? Date.parse(syncedAt) : NaN;
  const valid = Number.isFinite(timestamp) && timestamp <= now + 5 * 60_000;
  return {
    date: valid ? new Date(timestamp) : null,
    stale: !valid || now - timestamp > 2 * 60 * 60_000,
  };
}

export function shouldSyncParro(connectionState: string | undefined, forceSync: boolean, syncedAt: string | undefined, allowAutomaticSync = true, now = Date.now()) {
  const lastSync = syncedAt ? Date.parse(syncedAt) : NaN;
  return connectionState === "connected" && (forceSync || allowAutomaticSync && (Number.isNaN(lastSync) || now - lastSync >= 15 * 60_000));
}
