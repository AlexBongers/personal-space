import { makeSeed, normalizeItems } from "../app/personal-space/model.ts";
import type { Block, CellValue, Filter, Item, Property, Row, ViewSettings } from "../app/personal-space/types.ts";

export const WORKSPACE_ID = "primary";
export const MAX_WORKSPACE_BYTES = 2_000_000;
const MAX_ITEMS = 2_500;
const blockTypes = new Set(["paragraph", "heading1", "heading2", "heading3", "bulleted", "numbered", "todo", "quote", "divider", "code", "callout"]);
const propertyTypes = new Set(["text", "number", "select", "multi-select", "date", "checkbox", "url"]);
const viewModes = new Set(["table", "board", "list"]);
const filterOperators = new Set(["contains", "is", "is-not", "before", "after", "checked", "unchecked"]);

export type D1RunResult = { meta?: { changes?: number } };

export interface WorkspaceStatement {
  bind(...values: unknown[]): WorkspaceStatement;
  first<T>(): Promise<T | null>;
  run(): Promise<D1RunResult>;
}

export interface WorkspaceDatabase {
  prepare(query: string): WorkspaceStatement;
}

type StoredWorkspace = {
  revision: number;
  data: string;
  updated_at: string;
};

export type WorkspaceEnvelope = {
  items: Item[];
  revision: number;
  updatedAt: string;
};

export type WorkspaceSaveResult =
  | { ok: true; workspace: WorkspaceEnvelope }
  | { ok: false; current: WorkspaceEnvelope };

const schemaSql = `CREATE TABLE IF NOT EXISTS workspace_state (
  id TEXT PRIMARY KEY NOT NULL,
  revision INTEGER DEFAULT 1 NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
)`;

const selectSql = `SELECT revision, data, updated_at
FROM workspace_state
WHERE id = ?`;

export const ensureWorkspaceSchema = async (database: WorkspaceDatabase) => {
  await database.prepare(schemaSql).run();
};

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === "string";

const isBlock = (value: unknown): value is Block => {
  if (!isRecord(value)) return false;
  return isString(value.id) && isString(value.text) && blockTypes.has(String(value.type))
    && (value.checked === undefined || typeof value.checked === "boolean");
};

const isProperty = (value: unknown): value is Property => {
  if (!isRecord(value) || !isString(value.id) || !isString(value.name) || !propertyTypes.has(String(value.type))) return false;
  return value.options === undefined || (Array.isArray(value.options) && value.options.length <= 500 && value.options.every((option) =>
    isRecord(option) && isString(option.id) && isString(option.label) && isString(option.color)));
};

const isCellValue = (value: unknown): value is CellValue => value === null
  || isString(value)
  || typeof value === "boolean"
  || (typeof value === "number" && Number.isFinite(value))
  || (Array.isArray(value) && value.every(isString));

const isFilter = (value: unknown): value is Filter => isRecord(value)
  && isString(value.propertyId)
  && isString(value.query)
  && filterOperators.has(String(value.operator));

const isView = (value: unknown): value is ViewSettings => isRecord(value)
  && viewModes.has(String(value.mode))
  && isString(value.groupBy)
  && Array.isArray(value.filters)
  && value.filters.length <= 100
  && value.filters.every(isFilter)
  && isString(value.sortBy)
  && (value.sortDir === "asc" || value.sortDir === "desc");

const isRow = (value: unknown): value is Row => {
  if (!isRecord(value) || !isString(value.id) || !isString(value.title) || !isRecord(value.values)) return false;
  return Object.values(value.values).every(isCellValue)
    && Array.isArray(value.blocks)
    && value.blocks.length <= 5_000
    && value.blocks.every(isBlock);
};

export const isWorkspaceItems = (value: unknown): value is Item[] => {
  if (!Array.isArray(value) || value.length > MAX_ITEMS) return false;
  return value.every((item) => {
    if (!isRecord(item)) return false;
    const candidate = item as Partial<Item> & Record<string, unknown>;
    if (typeof candidate.id !== "string" || typeof candidate.title !== "string" || typeof candidate.icon !== "string") return false;
    if (candidate.parentId !== null && typeof candidate.parentId !== "string") return false;
    if (candidate.kind === "page") {
      return Array.isArray(candidate.blocks) && candidate.blocks.length <= 5_000 && candidate.blocks.every(isBlock);
    }
    if (candidate.kind !== "database"
      || !Array.isArray(candidate.properties)
      || candidate.properties.length > 128
      || !candidate.properties.every(isProperty)
      || !Array.isArray(candidate.rows)
      || candidate.rows.length > 5_000
      || !candidate.rows.every(isRow)
      || !isView(candidate.view)) return false;
    if (candidate.views === undefined) return true;
    if (!isRecord(candidate.views)) return false;
    return Object.values(candidate.views).every((view) => view === undefined || isView(view));
  });
};

const decodeWorkspace = (row: StoredWorkspace): WorkspaceEnvelope => {
  const parsed = JSON.parse(row.data) as unknown;
  if (!isWorkspaceItems(parsed)) throw new Error("Stored workspace is invalid");
  return {
    items: normalizeItems(parsed),
    revision: row.revision,
    updatedAt: row.updated_at,
  };
};

const selectWorkspace = async (database: WorkspaceDatabase) => {
  return database.prepare(selectSql).bind(WORKSPACE_ID).first<StoredWorkspace>();
};

export const loadWorkspace = async (database: WorkspaceDatabase): Promise<WorkspaceEnvelope> => {
  await ensureWorkspaceSchema(database);
  let row = await selectWorkspace(database);
  if (!row) {
    const seed = JSON.stringify(normalizeItems(makeSeed()));
    await database
      .prepare(`INSERT OR IGNORE INTO workspace_state (id, revision, data)
VALUES (?, 1, ?)`)
      .bind(WORKSPACE_ID, seed)
      .run();
    row = await selectWorkspace(database);
  }
  if (!row) throw new Error("Workspace initialization failed");
  return decodeWorkspace(row);
};

export const saveWorkspace = async (
  database: WorkspaceDatabase,
  items: Item[],
  expectedRevision: number,
): Promise<WorkspaceSaveResult> => {
  await ensureWorkspaceSchema(database);
  const data = JSON.stringify(normalizeItems(items));
  if (new TextEncoder().encode(data).byteLength > MAX_WORKSPACE_BYTES) {
    throw new RangeError("Workspace exceeds the storage limit");
  }
  const result = await database
    .prepare(`UPDATE workspace_state
SET data = ?, revision = revision + 1, updated_at = CURRENT_TIMESTAMP
WHERE id = ? AND revision = ?`)
    .bind(data, WORKSPACE_ID, expectedRevision)
    .run();
  const current = await selectWorkspace(database);
  if (!current) throw new Error("Workspace disappeared during save");
  const workspace = decodeWorkspace(current);
  return Number(result.meta?.changes || 0) > 0
    ? { ok: true, workspace }
    : { ok: false, current: workspace };
};
