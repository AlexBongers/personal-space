"use client";

import { useCallback, useEffect, useState, type SetStateAction } from "react";
import { makeSeed } from "./model.ts";
import {
  BrowserRecoveryStore,
  getDraftId,
  type RecoveryStorage,
} from "./workspace-recovery.ts";
import {
  WorkspacePersistenceController,
  type WorkspaceEnvelope,
  type WorkspaceSaveResult,
  type PersistenceStatus,
} from "./workspace-persistence-controller.ts";
import { isWorkspaceMutationLocked, subscribeWorkspaceMutationLock } from "./workspace-mutation-lock.ts";
import type { Item } from "./types";

export type SyncState = PersistenceStatus;

type WorkspaceResponse = WorkspaceEnvelope & { error?: string };

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

const transport = {
  async load(): Promise<WorkspaceEnvelope> {
    return readResponse(await fetch("/api/workspace", { cache: "no-store" }));
  },
  async save(items: Item[], baseRevision: number): Promise<WorkspaceSaveResult> {
    const response = await putWorkspace(items, baseRevision);
    if (response.status === 409) {
      const current = await response.json() as WorkspaceResponse;
      if (!Number.isInteger(current.revision) || !Array.isArray(current.items)) throw new Error(current.error || "Workspace conflict response is invalid");
      return { ok: false, current };
    }
    return { ok: true, workspace: await readResponse(response) };
  },
};

const unavailableStorage = (): RecoveryStorage => ({
  getItem: () => { throw new Error("Browser storage is unavailable"); },
  setItem: () => { throw new Error("Browser storage is unavailable"); },
  removeItem: () => { throw new Error("Browser storage is unavailable"); },
  length: 0,
  key: () => null,
});

const controllerForBrowser = () => {
  let local: RecoveryStorage = unavailableStorage();
  let session: RecoveryStorage = unavailableStorage();
  if (typeof window !== "undefined") {
    try { local = window.localStorage; } catch { /* Controller reports the storage failure. */ }
    try { session = window.sessionStorage; } catch { /* Controller uses an ephemeral draft id. */ }
  }
  let draftId = "server-render";
  try { draftId = getDraftId(session); } catch { draftId = `ephemeral-${Date.now().toString(36)}`; }
  return new WorkspacePersistenceController(transport, new BrowserRecoveryStore(local, draftId), makeSeed());
};

export function useWorkspacePersistence() {
  const [controller] = useState(controllerForBrowser);
  const [snapshot, setSnapshot] = useState(() => controller.snapshot);
  const [mutationLocked, setMutationLocked] = useState(isWorkspaceMutationLocked);

  useEffect(() => {
    const unsubscribe = controller.subscribe(setSnapshot);
    void controller.load();
    return () => { unsubscribe(); };
  }, [controller]);

  useEffect(() => subscribeWorkspaceMutationLock(setMutationLocked), []);

  useEffect(() => {
    const retry = () => {
      if (document.visibilityState === "visible") void controller.retry();
    };
    window.addEventListener("online", retry);
    document.addEventListener("visibilitychange", retry);
    return () => {
      window.removeEventListener("online", retry);
      document.removeEventListener("visibilitychange", retry);
    };
  }, [controller]);

  const setItems = useCallback((mutation: SetStateAction<Item[]>) => controller.apply(mutation), [controller]);
  const replaceItems = useCallback((items: Item[], revision: number) => controller.replaceItems(items, revision), [controller]);
  const retry = useCallback(() => controller.retry(), [controller]);
  const beginExternalMutation = useCallback(() => controller.beginExternalMutation(), [controller]);
  const acceptLegacyRecovery = useCallback(() => controller.acceptLegacyRecovery(), [controller]);
  const dismissLegacyRecovery = useCallback(() => controller.dismissLegacyRecovery(), [controller]);
  const recoverDraft = useCallback((draftId: string) => controller.recoverDraft(draftId), [controller]);
  const discardRecovery = useCallback((draftId: string) => controller.discardRecovery(draftId), [controller]);

  return {
    items: snapshot.items,
    setItems,
    replaceItems,
    revision: snapshot.revision,
    hydrated: snapshot.hydrated,
    backendReady: snapshot.backendReady,
    editingReady: snapshot.safeToEdit && !mutationLocked,
    mutationLocked,
    syncState: snapshot.status,
    conflicts: snapshot.conflicts,
    recoveryError: snapshot.recoveryError,
    recoveryRecords: snapshot.recoveryRecords,
    recoveryDraftId: controller.recoveryDraftId,
    legacyRecovery: snapshot.legacyRecovery,
    beginExternalMutation,
    acceptLegacyRecovery,
    dismissLegacyRecovery,
    recoverDraft,
    discardRecovery,
    retry,
  };
}
