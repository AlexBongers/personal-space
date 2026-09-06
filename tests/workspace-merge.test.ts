import assert from "node:assert/strict";
import test from "node:test";
import { makeSeed } from "../app/personal-space/model.ts";
import { mergeWorkspace, sameWorkspaceValue, validateWorkspaceTree } from "../app/personal-space/workspace-merge.ts";
import type { Page } from "../app/personal-space/types.ts";

const base = makeSeed();
const page = (items: typeof base, id: string) => {
  const item = items.find((entry): entry is Page => entry.id === id && entry.kind === "page");
  assert.ok(item);
  return item;
};

test("workspace equality ignores object key order while preserving array order", () => {
  assert.equal(sameWorkspaceValue({ a: 1, b: [1, 2] }, { b: [1, 2], a: 1 }), true);
  assert.equal(sameWorkspaceValue({ b: [1, 2] }, { b: [2, 1] }), false);
});

test("different pages changed from one base are merged in remote order", () => {
  const local = base.map((item) => item.id === "work" ? { ...item, title: "Local work" } : item);
  const remote = base.map((item) => item.id === "personal" ? { ...item, title: "Remote personal" } : item);
  const result = mergeWorkspace(base, local, remote);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(page(result.items, "work").title, "Local work");
  assert.equal(page(result.items, "personal").title, "Remote personal");
});

test("different changes to one item are a conflict", () => {
  const local = base.map((item) => item.id === "work" ? { ...item, title: "Local work" } : item);
  const remote = base.map((item) => item.id === "work" ? { ...item, title: "Remote work" } : item);
  const result = mergeWorkspace(base, local, remote);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.conflicts[0].id, "work");
});

test("delete versus unchanged accepts the deletion, delete versus edit conflicts", () => {
  const localDelete = base.filter((item) => item.id !== "work");
  const unchangedRemote = base;
  const deleted = mergeWorkspace(base, localDelete, unchangedRemote);
  assert.equal(deleted.ok, true);
  if (deleted.ok) assert.equal(deleted.items.some((item) => item.id === "work"), false);

  const remoteEdit = base.map((item) => item.id === "work" ? { ...item, title: "Remote" } : item);
  const conflict = mergeWorkspace(base, localDelete, remoteEdit);
  assert.equal(conflict.ok, false);
});

test("parent deletion and changed child cannot create an orphan", () => {
  const local = base.filter((item) => item.id !== "work" && item.id !== "launch");
  const remote = base.map((item) => item.id === "launch" ? { ...item, title: "Changed child" } : item);
  const result = mergeWorkspace(base, local, remote);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(["workspace", "launch"].includes(result.conflicts[0].id), true);
});

test("a new id is retained when added by one side", () => {
  const addition = { ...page(base, "work"), id: "new-page", title: "New page" };
  const result = mergeWorkspace(base, [...base, addition], base);
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(page(result.items, "new-page").title, "New page");
});

test("merged tree requires a root Home page and valid parents", () => {
  assert.equal(validateWorkspaceTree(base).valid, true);
  assert.equal(validateWorkspaceTree(base.filter((item) => item.id !== "home")).valid, false);
});

test("merged tree rejects an active child below a trashed parent", () => {
  const remote = base.map((item) => item.id === "work"
    ? { ...item, trash: { deletedAt: "2026-09-05T12:00:00.000Z", batchId: "batch-1", rootId: "work" } }
    : item);
  assert.equal(validateWorkspaceTree(remote).valid, false);
  assert.equal(mergeWorkspace(base, base, remote).ok, false);
});
