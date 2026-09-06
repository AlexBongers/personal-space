import { normalizeItems } from "./model.ts";
import type { Item } from "./types";
import {
  createRecoveryRecord,
  type LegacyRecoveryRecord,
  type RecoveryReadResult,
  type RecoveryStore,
  type WorkspaceRecoveryRecord,
} from "./workspace-recovery.ts";
import { mergeWorkspace, sameWorkspaceValue, type WorkspaceConflict, validateWorkspaceTree } from "./workspace-merge.ts";
import { acquireWorkspaceMutationLock, isWorkspaceMutationLocked } from "./workspace-mutation-lock.ts";

export type WorkspaceEnvelope = { items: Item[]; revision: number; updatedAt: string };
export type WorkspaceSaveResult =
  | { ok: true; workspace: WorkspaceEnvelope }
  | { ok: false; current: WorkspaceEnvelope };

export type WorkspaceTransport = {
  load(): Promise<WorkspaceEnvelope>;
  save(items: Item[], baseRevision: number): Promise<WorkspaceSaveResult>;
};

export type PersistenceStatus = "loading" | "saving" | "saved" | "offline" | "error" | "conflict";

export type WorkspacePersistenceState = {
  items: Item[];
  baseItems: Item[];
  revision: number;
  hydrated: boolean;
  backendReady: boolean;
  safeToEdit: boolean;
  status: PersistenceStatus;
  editGeneration: number;
  confirmedGeneration: number;
  conflicts: WorkspaceConflict[];
  recoveryRecords: WorkspaceRecoveryRecord[];
  legacyRecovery: LegacyRecoveryRecord | null;
  legacyImportGeneration?: number;
  recoveryError?: string;
  error?: string;
};

export type WorkspaceMutation = Item[] | ((current: Item[]) => Item[]);
export type WorkspaceMutationSession = {
  items: Item[];
  revision: number;
  release: () => void;
};

const SAVE_DEBOUNCE_MS = 650;
const MAX_CONFLICT_RETRIES = 2;

const sameItems = (left: Item[], right: Item[]) => sameWorkspaceValue(left, right);

const normalizeEnvelope = (envelope: WorkspaceEnvelope): WorkspaceEnvelope => {
  const items = normalizeItems(envelope.items);
  if (!Number.isInteger(envelope.revision) || envelope.revision < 1) throw new Error("Workspace revision is invalid");
  const tree = validateWorkspaceTree(items);
  if (!tree.valid) throw new Error(tree.reason);
  return { ...envelope, items };
};

export class WorkspacePersistenceController {
  private readonly transport: WorkspaceTransport;
  private readonly recovery: RecoveryStore;
  private state: WorkspacePersistenceState;
  private listeners = new Set<(state: WorkspacePersistenceState) => void>();
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private savePromise: Promise<void> | null = null;
  private loadPromise: Promise<void> | null = null;

  constructor(
    transport: WorkspaceTransport,
    recovery: RecoveryStore,
    seedItems: Item[],
  ) {
    this.transport = transport;
    this.recovery = recovery;
    this.state = {
      items: normalizeItems(seedItems),
      baseItems: [],
      revision: 0,
      hydrated: false,
      backendReady: false,
      safeToEdit: false,
      status: "loading",
      editGeneration: 0,
      confirmedGeneration: 0,
      conflicts: [],
      recoveryRecords: [],
      legacyRecovery: null,
    };
  }

  get snapshot() { return this.state; }
  get recoveryDraftId() { return this.recovery.draftId; }

  subscribe(listener: (state: WorkspacePersistenceState) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit() {
    for (const listener of this.listeners) listener(this.state);
  }

  private update(next: Partial<WorkspacePersistenceState>) {
    this.state = { ...this.state, ...next };
    this.emit();
  }

  async load(): Promise<void> {
    if (this.loadPromise) return this.loadPromise;
    const run = this.loadInternal();
    const tracked = run.finally(() => { this.loadPromise = null; });
    this.loadPromise = tracked;
    return tracked;
  }

  private async loadInternal() {
    let recoveryResult: RecoveryReadResult = { records: [], invalidKeys: [] };
    let legacyRecovery: LegacyRecoveryRecord | null = null;
    let legacyError: string | undefined;
    try {
      recoveryResult = this.recovery.readAll();
      const legacyResult = this.recovery.readLegacy?.();
      if (legacyResult?.invalid) legacyError = "The legacy browser workspace could not be read";
      if (legacyResult?.record) {
        try {
          const items = normalizeItems(legacyResult.record.items);
          const tree = validateWorkspaceTree(items);
          if (tree.valid) legacyRecovery = { ...legacyResult.record, items };
          else legacyError = tree.reason;
        } catch (error) {
          legacyError = error instanceof Error ? error.message : "The legacy browser workspace is invalid";
        }
      }
      this.update({
        recoveryRecords: recoveryResult.records,
        legacyRecovery,
        recoveryError: recoveryResult.invalidKeys.length ? "Some recovery data could not be read" : legacyError,
      });
    } catch (error) {
      this.update({ recoveryError: error instanceof Error ? error.message : "Recovery storage is unavailable" });
    }

    this.update({ status: "loading", error: undefined });
    try {
      const remote = normalizeEnvelope(await this.transport.load());
      const own = recoveryResult.records.find((record) => record.draftId === this.recovery.draftId);
      if (!own) {
        this.update({
          items: remote.items,
          baseItems: remote.items,
          revision: remote.revision,
          hydrated: true,
          backendReady: true,
          safeToEdit: true,
          status: "saved",
          editGeneration: 0,
          confirmedGeneration: 0,
          conflicts: [],
          legacyRecovery,
        });
        return;
      }

      const merged = mergeWorkspace(own.baseItems, own.draftItems, remote.items);
      if (!merged.ok) {
        this.update({
          items: normalizeItems(own.draftItems),
          baseItems: remote.items,
          revision: remote.revision,
          hydrated: true,
          backendReady: true,
          safeToEdit: true,
          status: "conflict",
          editGeneration: own.editGeneration,
          confirmedGeneration: 0,
          conflicts: merged.conflicts,
          legacyRecovery,
        });
        return;
      }

      this.update({
        items: merged.items,
        baseItems: remote.items,
        revision: remote.revision,
        hydrated: true,
        backendReady: true,
        safeToEdit: true,
        status: "saving",
        editGeneration: own.editGeneration,
        confirmedGeneration: 0,
        conflicts: [],
        legacyRecovery,
      });
      this.scheduleSave();
    } catch (error) {
      const own = recoveryResult.records.find((record) => record.draftId === this.recovery.draftId);
      if (own) {
        this.update({
          items: normalizeItems(own.draftItems),
          baseItems: normalizeItems(own.baseItems),
          revision: own.baseRevision,
          hydrated: true,
          backendReady: false,
          safeToEdit: true,
          status: "offline",
          editGeneration: own.editGeneration,
          confirmedGeneration: 0,
          conflicts: [],
          legacyRecovery,
          error: error instanceof Error ? error.message : "Workspace is offline",
        });
      } else {
        // Keep the deterministic seed visible for the loading screen, but do not make it editable
        // and never upload it as a replacement for a workspace we could not load.
        this.update({
          hydrated: true,
          backendReady: false,
          safeToEdit: false,
          status: "offline",
          conflicts: [],
          legacyRecovery,
          error: error instanceof Error ? error.message : "Workspace is offline",
        });
      }
    }
  }

  apply(mutation: WorkspaceMutation): boolean {
    if (!this.state.safeToEdit || this.state.conflicts.length || isWorkspaceMutationLocked()) return false;
    const next = normalizeItems(typeof mutation === "function" ? mutation(this.state.items) : mutation);
    if (sameItems(next, this.state.items)) return true;
    const generation = this.state.editGeneration + 1;
    this.update({ items: next, editGeneration: generation, status: this.state.backendReady ? "saving" : "offline", error: undefined });
    this.writeRecovery();
    this.scheduleSave();
    return true;
  }

  replaceItems(nextItems: Item[], nextRevision: number): boolean {
    const remoteItems = normalizeItems(nextItems);
    const tree = validateWorkspaceTree(remoteItems);
    if (!tree.valid || !Number.isInteger(nextRevision) || nextRevision < 1) return false;
    if (this.state.editGeneration > this.state.confirmedGeneration || this.savePromise) {
      const merged = mergeWorkspace(this.state.baseItems, this.state.items, remoteItems);
      if (!merged.ok) {
        this.update({ status: "conflict", conflicts: merged.conflicts });
        return false;
      }
      this.update({ items: merged.items, baseItems: remoteItems, revision: nextRevision, conflicts: [], status: "saving" });
      this.writeRecovery();
      this.scheduleSave();
      return true;
    }
    this.update({
      items: remoteItems,
      baseItems: remoteItems,
      revision: nextRevision,
      backendReady: true,
      safeToEdit: true,
      status: "saved",
      confirmedGeneration: this.state.editGeneration,
      conflicts: [],
    });
    try { this.recovery.clear(this.state.editGeneration); } catch (error) { this.setRecoveryError(error); }
    return true;
  }

  async flush(): Promise<void> {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    if (this.savePromise) return this.savePromise;
    if (!this.state.backendReady || !this.state.safeToEdit || this.state.conflicts.length) return;
    this.savePromise = this.saveLoop().finally(() => { this.savePromise = null; });
    return this.savePromise;
  }

  async retry() {
    if (this.saveTimer || this.savePromise) await this.flush();
    await this.load();
    if (this.state.backendReady && !this.state.conflicts.length) await this.flush();
  }

  async beginExternalMutation(): Promise<WorkspaceMutationSession | null> {
    if (!this.state.safeToEdit || !this.state.backendReady || this.state.conflicts.length || this.state.recoveryError) return null;
    const owner = `workspace-mutation-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const releaseLock = acquireWorkspaceMutationLock(owner);
    if (!releaseLock) return null;
    try {
      await this.flush();
      if (!this.state.backendReady || this.state.conflicts.length || this.state.editGeneration > this.state.confirmedGeneration || this.state.recoveryError) {
        releaseLock();
        return null;
      }
      return { items: this.state.items, revision: this.state.revision, release: releaseLock };
    } catch {
      releaseLock();
      return null;
    }
  }

  acceptLegacyRecovery(): boolean {
    if (!this.state.legacyRecovery || !this.state.backendReady || !this.state.safeToEdit || this.state.conflicts.length
      || this.state.editGeneration > this.state.confirmedGeneration || this.savePromise || this.saveTimer) return false;
    const generation = this.state.editGeneration + 1;
    this.update({ items: this.state.legacyRecovery.items, editGeneration: generation, status: "saving", legacyImportGeneration: generation, recoveryError: undefined });
    this.writeRecovery();
    this.scheduleSave();
    return true;
  }

  dismissLegacyRecovery() {
    try {
      this.recovery.clearLegacy?.();
      this.update({ legacyRecovery: null, legacyImportGeneration: undefined });
    } catch (error) {
      this.setRecoveryError(error);
    }
  }

  recoverDraft(draftId: string): boolean {
    const record = this.state.recoveryRecords.find((entry) => entry.draftId === draftId);
    if (!record || !this.state.backendReady || !this.state.safeToEdit || this.state.conflicts.length) return false;
    const merged = mergeWorkspace(record.baseItems, record.draftItems, this.state.baseItems);
    if (!merged.ok) {
      this.update({ status: "conflict", conflicts: merged.conflicts });
      return false;
    }
    const generation = this.state.editGeneration + 1;
    this.update({ items: merged.items, editGeneration: generation, status: "saving", conflicts: [] });
    this.writeRecovery();
    this.scheduleSave();
    return true;
  }

  discardRecovery(draftId: string) {
    try {
      this.recovery.clearDraft?.(draftId);
      this.update({ recoveryRecords: this.state.recoveryRecords.filter((entry) => entry.draftId !== draftId) });
    } catch (error) {
      this.setRecoveryError(error);
    }
  }

  private scheduleSave() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    if (!this.state.backendReady || this.state.conflicts.length || this.state.editGeneration <= this.state.confirmedGeneration) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      void this.flush();
    }, SAVE_DEBOUNCE_MS);
  }

  private async saveLoop() {
    let retries = 0;
    while (this.state.backendReady && this.state.safeToEdit && !this.state.conflicts.length
      && this.state.editGeneration > this.state.confirmedGeneration) {
      const requestGeneration = this.state.editGeneration;
      const requestItems = this.state.items;
      const requestBase = this.state.baseItems;
      const requestRevision = this.state.revision;
      this.update({ status: "saving", error: undefined });
      let result: WorkspaceSaveResult;
      try {
        result = await this.transport.save(requestItems, requestRevision);
      } catch (error) {
        this.update({ status: "offline", error: error instanceof Error ? error.message : "Workspace save failed" });
        return;
      }

      if (result.ok) {
        const saved = normalizeEnvelope(result.workspace);
        const currentGeneration = this.state.editGeneration;
        const changedDuringRequest = currentGeneration !== requestGeneration || !sameItems(this.state.items, requestItems);
        this.update({ baseItems: saved.items, revision: saved.revision });
        if (!changedDuringRequest) {
          this.update({ confirmedGeneration: requestGeneration, status: this.state.recoveryError ? "error" : "saved" });
          try { this.recovery.clear(requestGeneration); } catch (error) { this.setRecoveryError(error); }
          if (this.state.legacyImportGeneration === requestGeneration) {
            try {
              this.recovery.clearLegacy?.();
              this.update({ legacyRecovery: null, legacyImportGeneration: undefined });
            } catch (error) { this.setRecoveryError(error); }
          }
        } else {
          this.writeRecovery();
        }
        retries = 0;
        continue;
      }

      const remote = normalizeEnvelope(result.current);
      const merged = mergeWorkspace(requestBase, this.state.items, remote.items);
      if (!merged.ok) {
        this.update({ baseItems: remote.items, revision: remote.revision, status: "conflict", conflicts: merged.conflicts });
        return;
      }
      if (sameItems(merged.items, remote.items)) {
        this.update({ items: remote.items, baseItems: remote.items, revision: remote.revision, confirmedGeneration: this.state.editGeneration, status: "saved", conflicts: [] });
        try { this.recovery.clear(this.state.editGeneration); } catch (error) { this.setRecoveryError(error); }
        return;
      }
      if (retries >= MAX_CONFLICT_RETRIES) {
        this.update({ baseItems: remote.items, revision: remote.revision, status: "error", error: "Workspace changed repeatedly on another device; retry is required" });
        return;
      }
      const generation = sameItems(merged.items, this.state.items) ? this.state.editGeneration : this.state.editGeneration + 1;
      this.update({ items: merged.items, baseItems: remote.items, revision: remote.revision, editGeneration: generation, status: "saving", conflicts: [] });
      this.writeRecovery();
      retries += 1;
    }
  }

  private writeRecovery() {
    if (this.state.editGeneration <= this.state.confirmedGeneration) return;
    try {
      this.recovery.write(createRecoveryRecord({
        draftId: this.recovery.draftId,
        baseRevision: this.state.revision,
        baseItems: this.state.baseItems,
        draftItems: this.state.items,
        editGeneration: this.state.editGeneration,
      }));
      this.update({ recoveryError: undefined });
    } catch (error) {
      this.setRecoveryError(error);
    }
  }

  private setRecoveryError(error: unknown) {
    this.update({ recoveryError: error instanceof Error ? error.message : "Recovery storage is unavailable", status: "error" });
  }
}
