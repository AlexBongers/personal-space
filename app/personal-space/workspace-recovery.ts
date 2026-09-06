import type { Item } from "./types";
import { stableSerialize } from "./workspace-merge.ts";

export const RECOVERY_SCHEMA_VERSION = 1;
export const RECOVERY_KEY_PREFIX = "personal-space-recovery-v1:";
export const TAB_ID_KEY = "personal-space-tab-id-v1";
export const LEGACY_ITEMS_KEY = "personal-space-items";
export const LEGACY_SEED_VERSION_KEY = "personal-space-seed-version";

export type WorkspaceRecoveryRecord = {
  schemaVersion: typeof RECOVERY_SCHEMA_VERSION;
  draftId: string;
  baseRevision: number;
  baseItems: Item[];
  draftItems: Item[];
  editGeneration: number;
  savedAt: string;
};

export type RecoveryReadResult = {
  records: WorkspaceRecoveryRecord[];
  invalidKeys: string[];
};

export type LegacyRecoveryRecord = {
  key: typeof LEGACY_ITEMS_KEY;
  items: Item[];
  seedVersion: string | null;
};

export type LegacyReadResult = {
  record: LegacyRecoveryRecord | null;
  invalid: boolean;
};

export type RecoveryStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  readonly length: number;
  key(index: number): string | null;
};

export type RecoveryStore = {
  readonly key: string;
  readonly draftId: string;
  readAll(): RecoveryReadResult;
  readLegacy?(): LegacyReadResult;
  write(record: WorkspaceRecoveryRecord): void;
  clear(generation?: number): void;
  clearDraft?(draftId: string): void;
  clearLegacy?(): void;
};

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const isItems = (value: unknown): value is Item[] => Array.isArray(value) && value.every((item) => {
  if (!isRecord(item) || typeof item.id !== "string" || typeof item.kind !== "string") return false;
  if (item.kind === "page") {
    return Array.isArray(item.blocks) && item.blocks.every((block) => isRecord(block) && typeof block.id === "string");
  }
  if (item.kind !== "database") return false;
  if (!Array.isArray(item.properties) || !Array.isArray(item.rows) || !isRecord(item.view)) return false;
  return item.properties.every((property) => isRecord(property) && typeof property.id === "string")
    && item.rows.every((row) => isRecord(row) && typeof row.id === "string" && Array.isArray(row.blocks)
      && row.blocks.every((block) => isRecord(block) && typeof block.id === "string"));
});

export const isWorkspaceRecoveryRecord = (value: unknown): value is WorkspaceRecoveryRecord => {
  if (!isRecord(value)
    || value.schemaVersion !== RECOVERY_SCHEMA_VERSION
    || typeof value.draftId !== "string"
    || !Number.isInteger(value.baseRevision)
    || Number(value.baseRevision) < 1
    || !Number.isInteger(value.editGeneration)
    || Number(value.editGeneration) < 1
    || typeof value.savedAt !== "string"
    || !isItems(value.baseItems)
    || !isItems(value.draftItems)) return false;
  return value.draftId.length > 0 && value.draftId.length <= 200;
};

export const recoveryKey = (draftId: string) => `${RECOVERY_KEY_PREFIX}${draftId}`;

export const getDraftId = (sessionStorage: RecoveryStorage): string => {
  const existing = sessionStorage.getItem(TAB_ID_KEY);
  if (existing && /^[A-Za-z0-9._-]{1,200}$/.test(existing)) return existing;
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  sessionStorage.setItem(TAB_ID_KEY, random);
  return random;
};

export const readRecoveryRecords = (storage: RecoveryStorage): RecoveryReadResult => {
  const records: WorkspaceRecoveryRecord[] = [];
  const invalidKeys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key || !key.startsWith(RECOVERY_KEY_PREFIX)) continue;
    const raw = storage.getItem(key);
    if (!raw) {
      invalidKeys.push(key);
      continue;
    }
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!isWorkspaceRecoveryRecord(parsed)) invalidKeys.push(key);
      else records.push(parsed);
    } catch {
      invalidKeys.push(key);
    }
  }
  return { records, invalidKeys };
};

export const readLegacyWorkspace = (storage: RecoveryStorage): LegacyReadResult => {
  const raw = storage.getItem(LEGACY_ITEMS_KEY);
  if (!raw) return { record: null, invalid: false };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isItems(parsed)) return { record: null, invalid: true };
    return {
      record: {
        key: LEGACY_ITEMS_KEY,
        items: parsed,
        seedVersion: storage.getItem(LEGACY_SEED_VERSION_KEY),
      },
      invalid: false,
    };
  } catch {
    return { record: null, invalid: true };
  }
};

export const createRecoveryRecord = (args: Omit<WorkspaceRecoveryRecord, "schemaVersion" | "savedAt">): WorkspaceRecoveryRecord => ({
  schemaVersion: RECOVERY_SCHEMA_VERSION,
  ...args,
  savedAt: new Date().toISOString(),
});

export const sameRecoveryContent = (left: WorkspaceRecoveryRecord, right: WorkspaceRecoveryRecord) =>
  left.baseRevision === right.baseRevision
  && left.editGeneration === right.editGeneration
  && stableSerialize(left.baseItems) === stableSerialize(right.baseItems)
  && stableSerialize(left.draftItems) === stableSerialize(right.draftItems);

export class BrowserRecoveryStore implements RecoveryStore {
  readonly key: string;
  readonly draftId: string;
  private readonly storage: RecoveryStorage;

  constructor(storage: RecoveryStorage, draftId: string) {
    this.storage = storage;
    this.draftId = draftId;
    this.key = recoveryKey(draftId);
  }

  readAll() {
    return readRecoveryRecords(this.storage);
  }

  readLegacy() {
    return readLegacyWorkspace(this.storage);
  }

  write(record: WorkspaceRecoveryRecord) {
    if (record.draftId !== this.draftId) throw new Error("Recovery record belongs to another tab");
    this.storage.setItem(this.key, JSON.stringify(record));
  }

  clear(generation?: number) {
    if (generation !== undefined) {
      const raw = this.storage.getItem(this.key);
      if (!raw) return;
      try {
        const parsed: unknown = JSON.parse(raw);
        if (isWorkspaceRecoveryRecord(parsed) && parsed.editGeneration !== generation) return;
      } catch {
        return;
      }
    }
    this.storage.removeItem(this.key);
  }

  clearDraft(draftId: string) {
    if (draftId === this.draftId) this.clear();
    else this.storage.removeItem(recoveryKey(draftId));
  }

  clearLegacy() {
    this.storage.removeItem(LEGACY_ITEMS_KEY);
    this.storage.removeItem(LEGACY_SEED_VERSION_KEY);
  }
}
