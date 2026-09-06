import assert from "node:assert/strict";
import test from "node:test";
import { makeSeed } from "../app/personal-space/model.ts";
import {
  createWorkspaceExport,
  createWorkspaceRecoveryExport,
  serializeWorkspaceExport,
  workspaceExportFileName,
} from "../app/personal-space/workspace-export.ts";
import { markItemSubtreeTrashed } from "../app/personal-space/workspace-trash.ts";

test("workspace export uses a versioned allowlist and keeps trash and integration references", () => {
  const trashed = markItemSubtreeTrashed(makeSeed(), "work", { deletedAt: "2026-09-06T10:00:00.000Z", batchId: "batch-1", rootId: "work" }).items;
  const source = trashed.map((item) => item.id === "work" ? { ...item, apiToken: "must-not-export" } : item);
  const payload = createWorkspaceExport({
    items: source,
    sourceRevision: 12,
    containsUnconfirmedChanges: true,
    exportedAt: "2026-09-06T10:11:12.000Z",
  });

  assert.equal(payload.format, "personal-space");
  assert.equal(payload.schemaVersion, 1);
  assert.equal(payload.timeZone, "Europe/Amsterdam");
  assert.equal(payload.sourceRevision, 12);
  assert.equal(payload.containsUnconfirmedChanges, true);
  assert.equal(payload.items.find((item) => item.id === "work")?.trash?.batchId, "batch-1");
  assert.equal("apiToken" in (payload.items.find((item) => item.id === "work") || {}), false);

  source[0].title = "changed after click";
  assert.notEqual(payload.items[0].title, source[0].title);
  assert.match(serializeWorkspaceExport(payload), /"format": "personal-space"/);
  assert.equal(workspaceExportFileName(payload.exportedAt), "personal-space-20260906T101112Z.json");
});

test("recovery export preserves separate base, local, remote and conflict versions", () => {
  const baseItems = makeSeed();
  const localItems = baseItems.map((item) => item.id === "work" ? { ...item, title: "Local work" } : item);
  const remoteItems = baseItems.map((item) => item.id === "work" ? { ...item, title: "Remote work" } : item);
  const payload = createWorkspaceRecoveryExport({
    baseItems,
    localItems,
    remoteItems,
    sourceRevision: 13,
    conflicts: [{ id: "work", base: baseItems.find((item) => item.id === "work"), local: localItems.find((item) => item.id === "work"), remote: remoteItems.find((item) => item.id === "work") }],
    exportedAt: "2026-09-06T10:11:12.000Z",
  });

  assert.equal(payload.format, "personal-space-recovery");
  assert.equal(payload.containsUnconfirmedChanges, true);
  assert.equal(payload.recovery.baseItems.find((item) => item.id === "work")?.title, "Work studio");
  assert.equal(payload.recovery.localItems.find((item) => item.id === "work")?.title, "Local work");
  assert.equal(payload.recovery.remoteItems.find((item) => item.id === "work")?.title, "Remote work");
  assert.equal(payload.recovery.conflicts[0]?.id, "work");
  assert.equal(workspaceExportFileName(payload.exportedAt, true), "personal-space-recovery-20260906T101112Z.json");
});

test("export refuses an invalid workspace tree before download", () => {
  assert.throws(() => createWorkspaceExport({
    items: makeSeed().filter((item) => item.id !== "home"),
    sourceRevision: 1,
    containsUnconfirmedChanges: false,
  }), /root Home page/);
});
