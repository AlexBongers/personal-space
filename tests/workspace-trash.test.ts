import assert from "node:assert/strict";
import test from "node:test";
import { isWorkspaceItems, requiresTrashSupport, supportsTrash } from "../worker/workspace-store.ts";
import { activeItems, activeRows, markItemSubtreeTrashed, markRowTrashed, purgeTrashBatch, restoreTrashBatch } from "../app/personal-space/workspace-trash.ts";
import type { Database, Item, Page } from "../app/personal-space/types.ts";

const page = (id: string, parentId: string | null): Page => ({ id, kind: "page", title: id, icon: "page", parentId, blocks: [] });
const database = (): Database => ({
  id: "database", kind: "database", title: "Database", icon: "database", parentId: "home", properties: [],
  rows: [
    { id: "row-1", title: "One", values: {}, blocks: [] },
    { id: "row-2", title: "Two", values: {}, blocks: [] },
  ],
  view: { mode: "table", groupBy: "", filters: [], sortBy: "", sortDir: "asc" },
});

const workspace = (): Item[] => [page("home", null), page("parent", "home"), page("child", "parent"), database()];
const metadata = { deletedAt: "2026-09-05T12:00:00.000Z", batchId: "batch-1", rootId: "parent" };

test("trashing a subtree marks active descendants and rows as one batch", () => {
  const result = markItemSubtreeTrashed(workspace(), "parent", metadata);
  assert.equal(result.changed, true);
  assert.deepEqual(activeItems(result.items).map((item) => item.id), ["home", "database"]);
  const databaseItem = result.items.find((item) => item.id === "database");
  assert.equal(databaseItem?.kind, "database");
  if (databaseItem?.kind === "database") assert.equal(activeRows(databaseItem).length, 2);
  assert.deepEqual(result.affectedIds, ["parent", "child"]);
});

test("row trash is isolated and restore keeps a separately trashed child in trash", () => {
  const original = workspace();
  const rowTrash = markRowTrashed(original, "database", "row-1", { ...metadata, rootId: "row-1", batchId: "row-batch" });
  const subtree = markItemSubtreeTrashed(rowTrash.items, "parent", metadata);
  const restored = restoreTrashBatch(subtree.items, metadata.batchId);
  const child = restored.items.find((item) => item.id === "child");
  assert.ok(child && !child.trash);
  const restoredDatabase = restored.items.find((item) => item.id === "database");
  assert.equal(restoredDatabase?.kind, "database");
  if (restoredDatabase?.kind === "database") {
    assert.equal(restoredDatabase.rows.find((row) => row.id === "row-1")?.trash?.batchId, "row-batch");
    assert.equal(activeRows(restoredDatabase).length, 1);
  }
});

test("purging a parent removes its subtree and reports separately trashed descendants", () => {
  const first = markItemSubtreeTrashed(workspace(), "parent", metadata);
  const child = first.items.find((item) => item.id === "child");
  const separately = child ? first.items.map((item) => item.id === child.id ? { ...item, trash: { ...metadata, batchId: "older", rootId: child.id } } : item) : first.items;
  const purged = purgeTrashBatch(separately, metadata.batchId);
  assert.deepEqual(purged.items.map((item) => item.id), ["home", "database"]);
  assert.deepEqual(purged.separatelyTrashedIds, ["child"]);
  assert.equal(purged.removedCount, 2);
});

test("workspace validation accepts roundtrip metadata and rejects malformed or orphaned trash", () => {
  const valid = markItemSubtreeTrashed(workspace(), "parent", metadata).items;
  assert.equal(isWorkspaceItems(JSON.parse(JSON.stringify(valid))), true);
  assert.equal(isWorkspaceItems(valid.map((item) => item.id === "parent" ? { ...item, trash: { ...metadata, deletedAt: "not-a-date" } } : item)), false);
  assert.equal(isWorkspaceItems(valid.map((item) => item.id === "child" ? { ...item, trash: undefined } : item)), false);
  assert.equal(supportsTrash({ protocolVersion: 2, capabilities: ["trash"] }), true);
  assert.equal(requiresTrashSupport(valid, valid, undefined), true);
  assert.equal(requiresTrashSupport(valid, valid, { protocolVersion: 2, capabilities: ["trash"] }), false);
});
