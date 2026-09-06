import type {
  Block,
  CellValue,
  Database,
  Filter,
  Item,
  Page,
  Property,
  Row,
  SelectOption,
  TrashMetadata,
  ViewSettings,
} from "./types.ts";
import { validateWorkspaceTree, type WorkspaceConflict } from "./workspace-merge.ts";

export const WORKSPACE_EXPORT_FORMAT = "personal-space" as const;
export const WORKSPACE_RECOVERY_EXPORT_FORMAT = "personal-space-recovery" as const;
export const WORKSPACE_EXPORT_SCHEMA_VERSION = 1 as const;
export const WORKSPACE_EXPORT_TIME_ZONE = "Europe/Amsterdam" as const;
export const WORKSPACE_EXPORT_MIME_TYPE = "application/json;charset=utf-8";

type WorkspaceExportHeader = {
  schemaVersion: typeof WORKSPACE_EXPORT_SCHEMA_VERSION;
  exportedAt: string;
  timeZone: typeof WORKSPACE_EXPORT_TIME_ZONE;
  sourceRevision: number;
  containsUnconfirmedChanges: boolean;
};

export type WorkspaceExportV1 = WorkspaceExportHeader & {
  format: typeof WORKSPACE_EXPORT_FORMAT;
  items: Item[];
};

export type WorkspaceRecoveryExportV1 = WorkspaceExportHeader & {
  format: typeof WORKSPACE_RECOVERY_EXPORT_FORMAT;
  recovery: {
    baseItems: Item[];
    localItems: Item[];
    remoteItems: Item[];
    conflicts: WorkspaceConflict[];
  };
};

export type WorkspaceExportPayload = WorkspaceExportV1 | WorkspaceRecoveryExportV1;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const cloneCellValue = (value: CellValue): CellValue => Array.isArray(value) ? [...value] : value;

const cloneTrash = (trash: TrashMetadata | undefined): TrashMetadata | undefined => trash
  ? { deletedAt: trash.deletedAt, batchId: trash.batchId, rootId: trash.rootId }
  : undefined;

const cloneBlock = (block: Block): Block => {
  const copy: Block = { id: block.id, type: block.type, text: block.text };
  if (block.checked !== undefined) copy.checked = block.checked;
  return copy;
};

const cloneOption = (option: SelectOption): SelectOption => ({
  id: option.id,
  label: option.label,
  color: option.color,
});

const cloneProperty = (property: Property): Property => ({
  id: property.id,
  name: property.name,
  type: property.type,
  ...(property.options ? { options: property.options.map(cloneOption) } : {}),
});

const cloneFilter = (filter: Filter): Filter => ({
  propertyId: filter.propertyId,
  query: filter.query,
  operator: filter.operator,
});

const cloneView = (view: ViewSettings): ViewSettings => ({
  mode: view.mode,
  groupBy: view.groupBy,
  filters: view.filters.map(cloneFilter),
  sortBy: view.sortBy,
  sortDir: view.sortDir,
});

const cloneRow = (row: Row): Row => ({
  id: row.id,
  title: row.title,
  values: Object.fromEntries(Object.entries(row.values).map(([key, value]) => [key, cloneCellValue(value)])),
  blocks: row.blocks.map(cloneBlock),
  ...(row.trash ? { trash: cloneTrash(row.trash) } : {}),
});

const clonePage = (page: Page): Page => ({
  id: page.id,
  kind: "page",
  title: page.title,
  icon: page.icon,
  parentId: page.parentId,
  blocks: page.blocks.map(cloneBlock),
  ...(page.trash ? { trash: cloneTrash(page.trash) } : {}),
});

const cloneDatabase = (database: Database): Database => ({
  id: database.id,
  kind: "database",
  title: database.title,
  icon: database.icon,
  parentId: database.parentId,
  properties: database.properties.map(cloneProperty),
  rows: database.rows.map(cloneRow),
  view: cloneView(database.view),
  ...(database.views ? {
    views: Object.fromEntries(Object.entries(database.views).map(([mode, view]) => [mode, view ? cloneView(view) : view])),
  } : {}),
  ...(database.trash ? { trash: cloneTrash(database.trash) } : {}),
});

/**
 * Clone only the fields that make up the portable workspace format.
 * This deliberately drops runtime, auth and integration cache fields even if a
 * future client accidentally attaches them to an Item object.
 */
export const cloneWorkspaceItems = (items: Item[]): Item[] => items.map((item) =>
  item.kind === "database" ? cloneDatabase(item) : clonePage(item));

const validateExportInput = (items: Item[]) => {
  if (!Array.isArray(items)) throw new Error("Workspace export requires an item array");
  const tree = validateWorkspaceTree(items);
  if (!tree.valid) throw new Error(`Workspace export is invalid: ${tree.reason}`);
  return cloneWorkspaceItems(items);
};

const exportTimestamp = (value?: string) => {
  const timestamp = value || new Date().toISOString();
  if (Number.isNaN(new Date(timestamp).getTime())) throw new Error("Workspace export timestamp is invalid");
  return timestamp;
};

const validateRevision = (revision: number) => {
  if (!Number.isInteger(revision) || revision < 0) throw new Error("Workspace export revision is invalid");
  return revision;
};

const validateBoolean = (value: boolean) => {
  if (typeof value !== "boolean") throw new Error("Workspace export change status is invalid");
  return value;
};

export const createWorkspaceExport = (args: {
  items: Item[];
  sourceRevision: number;
  containsUnconfirmedChanges: boolean;
  exportedAt?: string;
}): WorkspaceExportV1 => ({
  format: WORKSPACE_EXPORT_FORMAT,
  schemaVersion: WORKSPACE_EXPORT_SCHEMA_VERSION,
  exportedAt: exportTimestamp(args.exportedAt),
  timeZone: WORKSPACE_EXPORT_TIME_ZONE,
  sourceRevision: validateRevision(args.sourceRevision),
  containsUnconfirmedChanges: validateBoolean(args.containsUnconfirmedChanges),
  items: validateExportInput(args.items),
});

const cloneConflict = (conflict: WorkspaceConflict): WorkspaceConflict => ({
  id: conflict.id,
  ...(conflict.base ? { base: cloneWorkspaceItems([conflict.base])[0] } : {}),
  ...(conflict.local ? { local: cloneWorkspaceItems([conflict.local])[0] } : {}),
  ...(conflict.remote ? { remote: cloneWorkspaceItems([conflict.remote])[0] } : {}),
  ...(conflict.reason ? { reason: conflict.reason } : {}),
});

/**
 * Recovery exports retain separate versions and are intentionally labelled as
 * recovery material. They are never presented as a merged workspace export.
 */
export const createWorkspaceRecoveryExport = (args: {
  baseItems: Item[];
  localItems: Item[];
  remoteItems: Item[];
  sourceRevision: number;
  conflicts: WorkspaceConflict[];
  exportedAt?: string;
}): WorkspaceRecoveryExportV1 => ({
  format: WORKSPACE_RECOVERY_EXPORT_FORMAT,
  schemaVersion: WORKSPACE_EXPORT_SCHEMA_VERSION,
  exportedAt: exportTimestamp(args.exportedAt),
  timeZone: WORKSPACE_EXPORT_TIME_ZONE,
  sourceRevision: validateRevision(args.sourceRevision),
  containsUnconfirmedChanges: true,
  recovery: {
    baseItems: validateExportInput(args.baseItems),
    localItems: validateExportInput(args.localItems),
    remoteItems: validateExportInput(args.remoteItems),
    conflicts: args.conflicts.map(cloneConflict),
  },
});

export const serializeWorkspaceExport = (payload: WorkspaceExportPayload) => `${JSON.stringify(payload, null, 2)}\n`;

const datePart = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

export const workspaceExportFileName = (exportedAt: string, recovery = false) => {
  const date = new Date(exportedAt);
  if (Number.isNaN(date.getTime())) throw new Error("Workspace export timestamp is invalid");
  return `personal-space-${recovery ? "recovery-" : ""}${datePart(date)}.json`;
};

/** Trigger a browser download and release the object URL after the click. */
export const downloadWorkspaceExport = (payload: WorkspaceExportPayload, fileName = workspaceExportFileName(payload.exportedAt, payload.format === WORKSPACE_RECOVERY_EXPORT_FORMAT)) => {
  if (typeof document === "undefined" || typeof URL === "undefined" || typeof Blob === "undefined") {
    throw new Error("Workspace export downloads are only available in a browser");
  }
  const blob = new Blob([serializeWorkspaceExport(payload)], { type: WORKSPACE_EXPORT_MIME_TYPE });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};

export const isWorkspaceExport = (value: unknown): value is WorkspaceExportV1 => {
  if (!isRecord(value) || value.format !== WORKSPACE_EXPORT_FORMAT || value.schemaVersion !== WORKSPACE_EXPORT_SCHEMA_VERSION) return false;
  return Array.isArray(value.items) && typeof value.exportedAt === "string" && value.timeZone === WORKSPACE_EXPORT_TIME_ZONE
    && Number.isInteger(value.sourceRevision) && typeof value.containsUnconfirmedChanges === "boolean";
};
