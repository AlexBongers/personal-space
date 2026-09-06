import type { Database, Item, Row, TrashMetadata } from "./types";

export type TrashMutation = {
  items: Item[];
  changed: boolean;
  affectedIds: string[];
};

export type TrashPurge = TrashMutation & {
  removedCount: number;
  separatelyTrashedIds: string[];
};

const unchanged = (items: Item[]): TrashMutation => ({ items, changed: false, affectedIds: [] });

const withoutItemTrash = (item: Item): Item => {
  const copy = { ...item };
  delete copy.trash;
  return copy;
};

const withoutRowTrash = (row: Row): Row => {
  const copy = { ...row };
  delete copy.trash;
  return copy;
};

export const isTrashed = (value: { trash?: TrashMetadata } | undefined): value is { trash: TrashMetadata } => Boolean(value?.trash);

export const activeItems = (items: Item[]): Item[] => items.filter((item) => !isTrashed(item));
export const activeRows = (database: Database): Row[] => database.rows.filter((row) => !isTrashed(row));

const descendantsOf = (items: Item[], rootId: string) => {
  const byId = new Map(items.map((item) => [item.id, item]));
  return (item: Item) => {
    if (item.id === rootId) return true;
    const seen = new Set<string>();
    let parentId = item.parentId;
    while (parentId && !seen.has(parentId)) {
      if (parentId === rootId) return true;
      seen.add(parentId);
      parentId = byId.get(parentId)?.parentId || null;
    }
    return false;
  };
};

/** Mark an active page/database and its active descendants in one trash batch. */
export const markItemSubtreeTrashed = (
  items: Item[],
  rootId: string,
  metadata: TrashMetadata,
): TrashMutation => {
  if (rootId === "home") return unchanged(items);
  const root = items.find((item) => item.id === rootId);
  if (!root || isTrashed(root)) return unchanged(items);
  const isDescendant = descendantsOf(items, rootId);
  const affectedIds: string[] = [];
  const nextItems = items.map((item) => {
    if (!isDescendant(item) || isTrashed(item)) return item;
    affectedIds.push(item.id);
    if (item.kind !== "database") return { ...item, trash: metadata };
    const rows = item.rows.map((row) => {
      if (isTrashed(row)) return row;
      affectedIds.push(`${item.id}/${row.id}`);
      return { ...row, trash: metadata };
    });
    return { ...item, rows, trash: metadata };
  });
  return { items: nextItems, changed: affectedIds.length > 0, affectedIds };
};

/** Mark one row without touching any other row in its database. */
export const markRowTrashed = (
  items: Item[],
  databaseId: string,
  rowId: string,
  metadata: TrashMetadata,
): TrashMutation => {
  const database = items.find((item): item is Database => item.id === databaseId && item.kind === "database");
  const row = database?.rows.find((entry) => entry.id === rowId);
  if (!database || isTrashed(database) || !row || isTrashed(row)) return unchanged(items);
  return {
    items: items.map((item) => item.id !== databaseId || item.kind !== "database"
      ? item
      : { ...item, rows: item.rows.map((entry) => entry.id === rowId ? { ...entry, trash: metadata } : entry) }),
    changed: true,
    affectedIds: [`${databaseId}/${rowId}`],
  };
};

/** Restore exactly one deletion batch, retaining separately deleted descendants. */
export const restoreTrashBatch = (items: Item[], batchId: string): TrashMutation => {
  const candidateItems = items.map((item) => {
    if (item.trash?.batchId !== batchId) return item;
    return withoutItemTrash(item);
  });
  const restoredIds: string[] = [];
  const byId = new Map(candidateItems.map((item) => [item.id, item]));
  const nextItems = candidateItems.map((item) => {
    if (item.trash || !items.find((original) => original.id === item.id)?.trash) return item;
    if (item.parentId && !byId.has(item.parentId)) {
      const original = items.find((entry) => entry.id === item.id);
      if (original?.trash) return original;
    }
    if (item.parentId && byId.get(item.parentId)?.trash) {
      const original = items.find((entry) => entry.id === item.id);
      if (original?.trash) return original;
    }
    restoredIds.push(item.id);
    return item;
  }).map((item) => {
    if (item.kind !== "database") return item;
    const original = items.find((entry) => entry.id === item.id);
    const rows = item.rows.map((row) => {
      if (row.trash?.batchId !== batchId) return row;
      if (item.trash) {
        const originalRow = original?.kind === "database" ? original.rows.find((entry) => entry.id === row.id) : undefined;
        return originalRow || row;
      }
      restoredIds.push(`${item.id}/${row.id}`);
      return withoutRowTrash(row);
    });
    return { ...item, rows };
  });
  return { items: nextItems, changed: restoredIds.length > 0, affectedIds: restoredIds };
};

/** Permanently remove a trashed item root and its descendants. */
export const purgeTrashRoot = (items: Item[], rootId: string): TrashPurge => {
  const root = items.find((item) => item.id === rootId);
  if (!root || !isTrashed(root) || rootId === "home") return { ...unchanged(items), removedCount: 0, separatelyTrashedIds: [] };
  const isDescendant = descendantsOf(items, rootId);
  const removedItemIds = new Set(items.filter(isDescendant).map((item) => item.id));
  const separatelyTrashedIds = items
    .filter((item) => removedItemIds.has(item.id) && item.trash && item.trash.batchId !== root.trash.batchId)
    .map((item) => item.id);
  items.forEach((item) => {
    if (!removedItemIds.has(item.id) || item.kind !== "database") return;
    item.rows.forEach((row) => {
      if (row.trash?.batchId !== root.trash.batchId) separatelyTrashedIds.push(`${item.id}/${row.id}`);
    });
  });
  const nextItems = items.filter((item) => !removedItemIds.has(item.id));
  let removedCount = removedItemIds.size;
  items.forEach((item) => {
    if (removedItemIds.has(item.id) && item.kind === "database") removedCount += item.rows.length;
  });
  return {
    items: nextItems,
    changed: removedItemIds.size > 0,
    affectedIds: [...removedItemIds],
    removedCount,
    separatelyTrashedIds,
  };
};

/** Permanently remove all records belonging to a trash action. */
export const purgeTrashBatch = (items: Item[], batchId: string): TrashPurge => {
  const root = items.find((item) => item.trash?.batchId === batchId && item.trash.rootId === item.id);
  if (root) return purgeTrashRoot(items, root.id);
  const nextItems = items.map((item) => item.kind === "database"
    ? { ...item, rows: item.rows.filter((row) => row.trash?.batchId !== batchId) }
    : item).filter((item) => item.trash?.batchId !== batchId);
  const removedCount = items.reduce((count, item) => count + (item.trash?.batchId === batchId ? 1 : 0)
    + (item.kind === "database" ? item.rows.filter((row) => row.trash?.batchId === batchId).length : 0), 0);
  return {
    items: nextItems,
    changed: removedCount > 0,
    affectedIds: items.filter((item) => item.trash?.batchId === batchId).map((item) => item.id),
    removedCount,
    separatelyTrashedIds: [],
  };
};

export const getActiveItems = activeItems;
export const getActiveRows = activeRows;
export const trashItemSubtree = markItemSubtreeTrashed;
