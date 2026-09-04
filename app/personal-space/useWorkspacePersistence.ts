"use client";

import { useEffect, useRef, useState } from "react";
import { makeSeed, mergeSeedAdditions, normalizeItems, SEED_VERSION, STORAGE_KEYS } from "./model";
import type { Item } from "./types";

export type SyncState = "loading" | "saving" | "saved" | "offline" | "error";

type WorkspaceResponse = {
  items: Item[];
  revision: number;
  updatedAt: string;
  error?: string;
};

const D1_MIGRATION_KEY = "personal-space-d1-migrated-v1";

const readResponse = async (response: Response): Promise<WorkspaceResponse> => {
  const body = await response.json() as WorkspaceResponse;
  if (!response.ok) throw new Error(body.error || `Workspace request failed (${response.status})`);
  return body;
};

const putWorkspace = (items: Item[], baseRevision: number) => fetch("/api/workspace", {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ items, baseRevision }),
});

const readLegacyWorkspace = () => {
  const stored = window.localStorage.getItem(STORAGE_KEYS.items);
  if (!stored) return null;
  const parsed = normalizeItems(JSON.parse(stored) as Item[]);
  const seedVersion = window.localStorage.getItem(STORAGE_KEYS.seedVersion);
  return seedVersion === SEED_VERSION ? parsed : mergeSeedAdditions(parsed);
};

export function useWorkspacePersistence() {
  const [items, setItems] = useState<Item[]>(() => normalizeItems(makeSeed()));
  const [hydrated, setHydrated] = useState(false);
  const [backendReady, setBackendReady] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>("loading");
  const [revision, setRevision] = useState(0);
  const revisionRef = useRef(0);
  const skipNextSaveRef = useRef(true);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        let remote = await readResponse(await fetch("/api/workspace", { cache: "no-store" }));
        let nextItems = normalizeItems(remote.items);
        const legacyMigrated = window.localStorage.getItem(D1_MIGRATION_KEY) === "true";
        const legacyItems = legacyMigrated ? null : readLegacyWorkspace();

        if (remote.revision === 1 && legacyItems) {
          const migrationResponse = await putWorkspace(legacyItems, remote.revision);
          if (migrationResponse.status === 409) {
            remote = await migrationResponse.json() as WorkspaceResponse;
          } else {
            remote = await readResponse(migrationResponse);
          }
          nextItems = normalizeItems(remote.items);
        }

        if (cancelled) return;
        revisionRef.current = remote.revision;
        setRevision(remote.revision);
        skipNextSaveRef.current = true;
        setItems(nextItems);
        setBackendReady(true);
        setSyncState("saved");
        window.localStorage.setItem(D1_MIGRATION_KEY, "true");
        window.localStorage.removeItem(STORAGE_KEYS.items);
        window.localStorage.removeItem(STORAGE_KEYS.seedVersion);
      } catch {
        if (cancelled) return;
        try {
          const fallback = readLegacyWorkspace();
          if (fallback) setItems(fallback);
        } catch {
          // Keep the deterministic seed if both D1 and the legacy backup are unavailable.
        }
        setSyncState("offline");
      } finally {
        if (!cancelled) setHydrated(true);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!backendReady) {
      window.localStorage.setItem(STORAGE_KEYS.items, JSON.stringify(items));
      return;
    }
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }

    const snapshot = items;
    const timer = window.setTimeout(() => {
      setSyncState("saving");
      saveQueueRef.current = saveQueueRef.current.then(async () => {
        let response = await putWorkspace(snapshot, revisionRef.current);
        if (response.status === 409) {
          const conflict = await response.json() as WorkspaceResponse;
          if (!Number.isInteger(conflict.revision)) throw new Error(conflict.error || "Workspace conflict");
          revisionRef.current = conflict.revision;
          response = await putWorkspace(snapshot, revisionRef.current);
        }
        const saved = await readResponse(response);
        revisionRef.current = saved.revision;
        setRevision(saved.revision);
        setSyncState("saved");
        window.localStorage.removeItem(STORAGE_KEYS.items);
      }).catch(() => {
        window.localStorage.setItem(STORAGE_KEYS.items, JSON.stringify(snapshot));
        setSyncState("error");
      });
    }, 650);

    return () => window.clearTimeout(timer);
  }, [backendReady, hydrated, items]);

  const replaceItems = (nextItems: Item[], nextRevision: number) => {
    revisionRef.current = nextRevision;
    setRevision(nextRevision);
    skipNextSaveRef.current = true;
    setSyncState("saved");
    setItems(normalizeItems(nextItems));
  };

  return { items, setItems, replaceItems, revision, hydrated, syncState };
}
