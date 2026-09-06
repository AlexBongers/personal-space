import assert from "node:assert/strict";
import test from "node:test";
import { makeSeed } from "../app/personal-space/model.ts";
import {
  WorkspacePersistenceController,
  type WorkspaceEnvelope,
  type WorkspaceSaveResult,
} from "../app/personal-space/workspace-persistence-controller.ts";
import type { Item } from "../app/personal-space/types.ts";
import {
  type LegacyReadResult,
  type LegacyRecoveryRecord,
  type RecoveryReadResult,
  type RecoveryStore,
  type WorkspaceRecoveryRecord,
} from "../app/personal-space/workspace-recovery.ts";

class MemoryRecovery implements RecoveryStore {
  readonly key: string;
  readonly draftId: string;
  private readonly records: Map<string, WorkspaceRecoveryRecord>;
  legacy: LegacyRecoveryRecord | null = null;
  constructor(draftId: string, records = new Map<string, WorkspaceRecoveryRecord>()) { this.draftId = draftId; this.key = `personal-space-recovery-v1:${draftId}`; this.records = records; }
  readAll(): RecoveryReadResult { return { records: [...this.records.values()], invalidKeys: [] }; }
  readLegacy(): LegacyReadResult { return { record: this.legacy, invalid: false }; }
  write(record: WorkspaceRecoveryRecord) { this.records.set(record.draftId, structuredClone(record)); }
  clear(generation?: number) { const record = this.records.get(this.draftId); if (generation === undefined || record?.editGeneration === generation) this.records.delete(this.draftId); }
  clearDraft(draftId: string) { this.records.delete(draftId); }
  clearLegacy() { this.legacy = null; }
  get current() { return this.records.get(this.draftId) || null; }
}

class FakeTransport {
  envelope: WorkspaceEnvelope;
  saves: Array<{ items: Item[]; baseRevision: number }> = [];
  failLoad = false;
  loadCount = 0;
  constructor(items = makeSeed(), revision = 1) {
    this.envelope = { items, revision, updatedAt: "2026-09-06T00:00:00.000Z" };
  }
  async load() {
    this.loadCount += 1;
    if (this.failLoad) throw new Error("offline");
    return structuredClone(this.envelope);
  }
  async save(items: Item[], baseRevision: number): Promise<WorkspaceSaveResult> {
    this.saves.push({ items: structuredClone(items), baseRevision });
    if (baseRevision !== this.envelope.revision) return { ok: false, current: structuredClone(this.envelope) };
    this.envelope = { items: structuredClone(items), revision: this.envelope.revision + 1, updatedAt: "2026-09-06T00:00:01.000Z" };
    return { ok: true, workspace: structuredClone(this.envelope) };
  }
}

const load = async (transport: FakeTransport, draftId: string) => {
  const controller = new WorkspacePersistenceController(transport, new MemoryRecovery(draftId), makeSeed());
  await controller.load();
  return controller;
};

const changeTitle = (controller: WorkspacePersistenceController, id: string, title: string) => {
  assert.equal(controller.apply((items) => items.map((item) => item.id === id ? { ...item, title } : item)), true);
};

test("two clients changing different pages preserve both changes", async () => {
  const transport = new FakeTransport();
  const first = await load(transport, "a");
  const second = await load(transport, "b");
  changeTitle(first, "work", "Local work");
  await first.flush();
  changeTitle(second, "personal", "Remote personal");
  await second.flush();
  assert.equal(second.snapshot.status, "saved");
  assert.equal(transport.envelope.items.find((item) => item.id === "work")?.title, "Local work");
  assert.equal(transport.envelope.items.find((item) => item.id === "personal")?.title, "Remote personal");
});

test("two clients changing the same page stop at a visible conflict", async () => {
  const transport = new FakeTransport();
  const first = await load(transport, "a");
  const second = await load(transport, "b");
  changeTitle(first, "work", "First");
  await first.flush();
  changeTitle(second, "work", "Second");
  await second.flush();
  assert.equal(second.snapshot.status, "conflict");
  assert.equal(second.snapshot.conflicts.length > 0, true);
  assert.equal(transport.saves.length, 2);
});

test("edits made while a request is in flight are sent after the confirmed snapshot", async () => {
  const transport = new FakeTransport();
  const controller = await load(transport, "a");
  let resolveFirst!: (value: WorkspaceSaveResult) => void;
  const originalSave = transport.save.bind(transport);
  let firstRequest = true;
  transport.save = async (items, revision) => {
    if (firstRequest) {
      firstRequest = false;
      return new Promise<WorkspaceSaveResult>((resolve) => { resolveFirst = resolve; });
    }
    return originalSave(items, revision);
  };
  changeTitle(controller, "work", "A");
  const saving = controller.flush();
  changeTitle(controller, "personal", "B");
  const confirmed = transport.envelope.items.map((item) => item.id === "work" ? { ...item, title: "A" } : item);
  transport.envelope = { items: confirmed, revision: 2, updatedAt: "2026-09-06T00:00:01.000Z" };
  resolveFirst({ ok: true, workspace: structuredClone(transport.envelope) });
  await saving;
  assert.equal(controller.snapshot.status, "saved");
  assert.equal(transport.envelope.items.find((item) => item.id === "work")?.title, "A");
  assert.equal(transport.envelope.items.find((item) => item.id === "personal")?.title, "B");
});

test("recovery is written before debounce and reopens an offline draft", async () => {
  const transport = new FakeTransport();
  const recovery = new MemoryRecovery("a");
  const controller = new WorkspacePersistenceController(transport, recovery, makeSeed());
  await controller.load();
  changeTitle(controller, "work", "Recovered work");
  assert.ok(recovery.current);
  transport.failLoad = true;
  const reopened = new WorkspacePersistenceController(transport, recovery, makeSeed());
  await reopened.load();
  assert.equal(reopened.snapshot.safeToEdit, true);
  assert.equal(reopened.snapshot.status, "offline");
  assert.equal(reopened.snapshot.items.find((item) => item.id === "work")?.title, "Recovered work");
});

test("a successful GET never clears a pending recovery before a confirming PUT", async () => {
  const transport = new FakeTransport();
  const recovery = new MemoryRecovery("a");
  const controller = new WorkspacePersistenceController(transport, recovery, makeSeed());
  await controller.load();
  changeTitle(controller, "work", "Pending");
  assert.ok(recovery.current);
  const reopened = new WorkspacePersistenceController(transport, recovery, makeSeed());
  await reopened.load();
  assert.ok(recovery.current);
  await reopened.flush();
  assert.equal(recovery.current, null);
});

test("retry waits for an in-flight save before loading again", async () => {
  const transport = new FakeTransport();
  const controller = await load(transport, "retry");
  let resolveSave!: () => void;
  transport.save = async (items) => new Promise<WorkspaceSaveResult>((resolve) => {
    resolveSave = () => resolve({ ok: true, workspace: { items, revision: 2, updatedAt: "2026-09-06T00:00:01.000Z" } });
  });
  changeTitle(controller, "work", "Pending save");
  const saving = controller.flush();
  const retrying = controller.retry();
  await Promise.resolve();
  assert.equal(transport.loadCount, 1);
  resolveSave();
  await Promise.all([saving, retrying]);
  assert.equal(transport.loadCount, 2);
});

test("external Google mutation owns a shared lock and returns the flushed snapshot", async () => {
  const transport = new FakeTransport();
  const controller = await load(transport, "lock");
  changeTitle(controller, "work", "Before sync");
  const session = await controller.beginExternalMutation();
  assert.ok(session);
  assert.equal(session.items.find((item) => item.id === "work")?.title, "Before sync");
  assert.equal(controller.apply((items) => items), false);
  session.release();
  assert.equal(controller.apply((items) => items), true);
  await controller.flush();
});

test("legacy workspace is exposed for explicit import instead of automatic upload", async () => {
  const transport = new FakeTransport();
  const recovery = new MemoryRecovery("legacy");
  recovery.legacy = { key: "personal-space-items", items: makeSeed().map((item) => item.id === "home" ? { ...item, title: "Legacy Home" } : item), seedVersion: "4" };
  const controller = new WorkspacePersistenceController(transport, recovery, makeSeed());
  await controller.load();
  assert.equal(controller.snapshot.items.find((item) => item.id === "home")?.title, "Home");
  assert.equal(controller.snapshot.legacyRecovery?.items[0].title, "Legacy Home");
  assert.equal(transport.saves.length, 0);
  changeTitle(controller, "work", "Current draft");
  assert.equal(controller.acceptLegacyRecovery(), false);
  await controller.flush();
  assert.equal(controller.acceptLegacyRecovery(), true);
  assert.ok(recovery.legacy);
  await controller.flush();
  assert.equal(transport.envelope.items.find((item) => item.id === "home")?.title, "Legacy Home");
  assert.equal(recovery.legacy, null);
});

test("recovery drafts from another tab are available and can be adopted or discarded", async () => {
  const transport = new FakeTransport();
  const records = new Map<string, WorkspaceRecoveryRecord>();
  const first = new MemoryRecovery("first", records);
  const second = new MemoryRecovery("second", records);
  const firstController = new WorkspacePersistenceController(transport, first, makeSeed());
  await firstController.load();
  changeTitle(firstController, "work", "Other tab");
  assert.ok(first.current);
  const secondController = new WorkspacePersistenceController(transport, second, makeSeed());
  await secondController.load();
  assert.equal(secondController.snapshot.recoveryRecords.some((record) => record.draftId === "first"), true);
  assert.equal(secondController.recoverDraft("first"), true);
  await secondController.flush();
  assert.equal(transport.envelope.items.find((item) => item.id === "work")?.title, "Other tab");
  secondController.discardRecovery("first");
  assert.equal(secondController.snapshot.recoveryRecords.some((record) => record.draftId === "first"), false);
});
