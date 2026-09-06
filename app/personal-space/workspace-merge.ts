import type { Item } from "./types";

/**
 * Serialize JSON-like workspace data without depending on object key order.
 * Arrays deliberately keep their order: block and row order is meaningful.
 */
export const stableSerialize = (value: unknown): string => {
  if (value === undefined) return "undefined";
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`).join(",")}}`;
  }
  return String(value);
};

export const sameWorkspaceValue = (left: unknown, right: unknown) => stableSerialize(left) === stableSerialize(right);

export type WorkspaceConflict = {
  id: string;
  base?: Item;
  local?: Item;
  remote?: Item;
  reason?: string;
};

export type WorkspaceMergeResult =
  | { ok: true; items: Item[] }
  | { ok: false; conflicts: WorkspaceConflict[] };

export type WorkspaceTreeValidation = { valid: true } | { valid: false; reason: string; ids?: string[] };

/** Validate relationships which the item-level merge must never repair silently. */
export const validateWorkspaceTree = (items: Item[]): WorkspaceTreeValidation => {
  const byId = new Map<string, Item>();
  for (const item of items) {
    if (!item.id || byId.has(item.id)) return { valid: false, reason: "Duplicate workspace item id", ids: [item.id] };
    byId.set(item.id, item);
  }
  const home = byId.get("home");
  if (!home || home.kind !== "page" || home.parentId !== null) {
    return { valid: false, reason: "Workspace must contain a root Home page", ids: ["home"] };
  }
  for (const item of items) {
    if (item.parentId !== null && !byId.has(item.parentId)) {
      return { valid: false, reason: "Workspace contains an item whose parent is missing", ids: [item.id, item.parentId] };
    }
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): WorkspaceTreeValidation => {
    if (visiting.has(id)) return { valid: false, reason: "Workspace contains a parent cycle", ids: [id] };
    if (visited.has(id)) return { valid: true };
    visiting.add(id);
    const item = byId.get(id);
    if (item?.parentId !== null && item?.parentId !== undefined) {
      const result = visit(item.parentId);
      if (!result.valid) return result;
    }
    visiting.delete(id);
    visited.add(id);
    return { valid: true };
  };
  for (const item of items) {
    const result = visit(item.id);
    if (!result.valid) return result;
  }
  return { valid: true };
};

/**
 * Merge one local draft with a remote CAS conflict at Item.id granularity.
 * Pages and databases are intentionally atomic units in this first version.
 */
export const mergeWorkspace = (base: Item[], local: Item[], remote: Item[]): WorkspaceMergeResult => {
  const baseById = new Map(base.map((item) => [item.id, item]));
  const localById = new Map(local.map((item) => [item.id, item]));
  const remoteById = new Map(remote.map((item) => [item.id, item]));
  const conflicts: WorkspaceConflict[] = [];
  const chosen = new Map<string, Item>();

  const ids = new Set([...baseById.keys(), ...localById.keys(), ...remoteById.keys()]);
  for (const id of ids) {
    const baseItem = baseById.get(id);
    const localItem = localById.get(id);
    const remoteItem = remoteById.get(id);
    const localChanged = !sameWorkspaceValue(localItem, baseItem);
    const remoteChanged = !sameWorkspaceValue(remoteItem, baseItem);

    if (!localChanged) {
      if (remoteItem) chosen.set(id, remoteItem);
      continue;
    }
    if (!remoteChanged || sameWorkspaceValue(localItem, remoteItem)) {
      if (localItem) chosen.set(id, localItem);
      continue;
    }
    conflicts.push({ id, base: baseItem, local: localItem, remote: remoteItem });
  }
  if (conflicts.length) return { ok: false, conflicts };

  // Preserve the server's order. Only local additions may be appended.
  const selected = new Map(chosen);
  let subtreeConflict = false;
  // A deleted parent carries its unchanged descendants with it. A descendant
  // changed on either side cannot be safely cascaded and becomes one conflict group.
  let changed = true;
  while (changed) {
    changed = false;
    for (const item of [...selected.values()]) {
      if (item.parentId === null || selected.has(item.parentId)) continue;
      const baseItem = baseById.get(item.id);
      const localItem = localById.get(item.id);
      const remoteItem = remoteById.get(item.id);
      if (!sameWorkspaceValue(localItem, baseItem) || !sameWorkspaceValue(remoteItem, baseItem)) {
        subtreeConflict = true;
      } else {
        selected.delete(item.id);
        changed = true;
      }
    }
  }
  if (subtreeConflict) return { ok: false, conflicts: [{ id: "workspace", reason: "A parent deletion overlaps a changed descendant" }] };

  const items = remote
    .map((item) => selected.get(item.id))
    .filter((item): item is Item => Boolean(item));
  for (const item of local) {
    if (!remoteById.has(item.id) && selected.has(item.id)) items.push(item);
  }

  const tree = validateWorkspaceTree(items);
  if (!tree.valid) {
    return {
      ok: false,
      conflicts: [{ id: "workspace", reason: tree.reason }],
    };
  }
  return { ok: true, items };
};
