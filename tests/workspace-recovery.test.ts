import assert from "node:assert/strict";
import test from "node:test";
import { makeSeed } from "../app/personal-space/model.ts";
import {
  BrowserRecoveryStore,
  RECOVERY_KEY_PREFIX,
  createRecoveryRecord,
  getDraftId,
  isWorkspaceRecoveryRecord,
  readLegacyWorkspace,
  readRecoveryRecords,
} from "../app/personal-space/workspace-recovery.ts";
import type { RecoveryStorage } from "../app/personal-space/workspace-recovery.ts";

class MemoryStorage implements RecoveryStorage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
}

test("recovery records are versioned and isolated by draft id", () => {
  const storage = new MemoryStorage();
  const store = new BrowserRecoveryStore(storage, "tab-a");
  const record = createRecoveryRecord({ draftId: "tab-a", baseRevision: 3, baseItems: makeSeed(), draftItems: makeSeed(), editGeneration: 2 });
  store.write(record);
  assert.equal(storage.getItem(`${RECOVERY_KEY_PREFIX}tab-a`) !== null, true);
  assert.equal(readRecoveryRecords(storage).records.length, 1);
  assert.equal(isWorkspaceRecoveryRecord(record), true);
  store.clear(1);
  assert.equal(readRecoveryRecords(storage).records.length, 1);
  store.clear(2);
  assert.equal(readRecoveryRecords(storage).records.length, 0);
});

test("corrupt and legacy records are reported without being used as recovery", () => {
  const storage = new MemoryStorage();
  storage.setItem(`${RECOVERY_KEY_PREFIX}bad`, "{broken");
  storage.setItem("personal-space-items", JSON.stringify(makeSeed()));
  const result = readRecoveryRecords(storage);
  assert.deepEqual(result.records, []);
  assert.deepEqual(result.invalidKeys, [`${RECOVERY_KEY_PREFIX}bad`]);
});

test("tab id survives reload through session storage", () => {
  const session = new MemoryStorage();
  const first = getDraftId(session);
  assert.equal(getDraftId(session), first);
});

test("legacy browser workspace remains available for an explicit migration choice", () => {
  const storage = new MemoryStorage();
  storage.setItem("personal-space-items", JSON.stringify(makeSeed()));
  storage.setItem("personal-space-seed-version", "4");
  const result = readLegacyWorkspace(storage);
  assert.equal(result.invalid, false);
  assert.equal(result.record?.items[0].id, "home");
  assert.equal(result.record?.seedVersion, "4");
  assert.equal(storage.getItem("personal-space-items") !== null, true);
  new BrowserRecoveryStore(storage, "tab-a").clearLegacy();
  assert.equal(storage.getItem("personal-space-items"), null);
  assert.equal(storage.getItem("personal-space-seed-version"), null);
});

test("legacy browser workspace corruption is reported without being uploaded", () => {
  const storage = new MemoryStorage();
  storage.setItem("personal-space-items", "{broken");
  const result = readLegacyWorkspace(storage);
  assert.equal(result.invalid, true);
  assert.equal(result.record, null);
});
