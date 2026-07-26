export type PageType = "page" | "database" | "row";

export interface TreeNode {
  id: string;
  parent_id: string | null;
  type: PageType;
  title: string;
  icon: string | null;
  position: number;
  children: TreeNode[];
}

export interface Block {
  id: string;
  page_id: string;
  type: string;
  content: Record<string, unknown>;
  position: number;
}

export interface PageData {
  id: string;
  parent_id: string | null;
  type: PageType;
  title: string;
  icon: string | null;
  blocks: Block[];
}

export type PropertyType = "text" | "number" | "select" | "multi_select" | "date" | "checkbox" | "url";
export type ViewKind = "table" | "board" | "list";

export interface PropertyOption {
  id: string;
  name: string;
  color: string;
  position: number;
}

export interface Property {
  id: string;
  name: string;
  type: PropertyType;
  position: number;
  options: PropertyOption[];
}

export interface DbRow {
  id: string;
  title: string;
  icon: string | null;
  position: number;
  values: Record<string, unknown>;
}

export interface Filter {
  propertyId: string;
  operator: string;
  value?: unknown;
}

export interface ViewConfig {
  filters: Filter[];
  sort: { propertyId: string; direction: "asc" | "desc" } | null;
  groupBy: string | null;
}

export interface DatabaseData {
  id: string;
  title: string;
  icon: string | null;
  properties: Property[];
  rows: DbRow[];
  views: Record<ViewKind, ViewConfig>;
}

export interface RowData {
  id: string;
  database_id: string;
  database_title: string;
  title: string;
  properties: Property[];
  values: Record<string, unknown>;
}

async function req<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error((detail as { error?: string }).error ?? `${method} ${url} failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  tree: () => req<TreeNode[]>("GET", "/api/tree"),
  createBlock: (
    pageId: string,
    data: { id?: string; type: string; content: Record<string, unknown>; index?: number },
  ) => req<Block>("POST", `/api/pages/${pageId}/blocks`, data),
  updateBlock: (id: string, data: { type?: string; content?: Record<string, unknown> }) =>
    req<Block>("PATCH", `/api/blocks/${id}`, data),
  deleteBlock: (id: string) => req<{ ok: boolean }>("DELETE", `/api/blocks/${id}`),
  reorderBlocks: (pageId: string, ids: string[]) =>
    req<{ ok: boolean }>("PUT", `/api/pages/${pageId}/blocks/order`, { ids }),
  createPage: (data: { parentId?: string | null; title?: string; icon?: string | null; type?: PageType }) =>
    req<PageData>("POST", "/api/pages", data),
  getPage: (id: string) => req<PageData>("GET", `/api/pages/${id}`),
  updatePage: (id: string, data: { title?: string; icon?: string | null }) =>
    req<PageData>("PATCH", `/api/pages/${id}`, data),
  deletePage: (id: string) => req<{ ok: boolean }>("DELETE", `/api/pages/${id}`),
  getDatabase: (id: string) => req<DatabaseData>("GET", `/api/databases/${id}`),
  addProperty: (dbId: string, data: { name: string; type: PropertyType }) =>
    req<Property>("POST", `/api/databases/${dbId}/properties`, data),
  renameProperty: (id: string, name: string) => req<Property>("PATCH", `/api/properties/${id}`, { name }),
  deleteProperty: (id: string) => req<{ ok: boolean }>("DELETE", `/api/properties/${id}`),
  addOption: (propertyId: string, data: { name: string; color: string }) =>
    req<PropertyOption>("POST", `/api/properties/${propertyId}/options`, data),
  addRow: (dbId: string, data: { title?: string; values?: Record<string, unknown> } = {}) =>
    req<DbRow>("POST", `/api/databases/${dbId}/rows`, data),
  setRowValue: (rowId: string, propertyId: string, value: unknown) =>
    req<{ ok: boolean }>("PATCH", `/api/rows/${rowId}/values`, { propertyId, value }),
  getRow: (id: string) => req<RowData>("GET", `/api/rows/${id}`),
  updateView: (dbId: string, kind: ViewKind, config: Partial<ViewConfig>) =>
    req<ViewConfig>("PATCH", `/api/databases/${dbId}/views/${kind}`, config),
  search: (q: string) => req<SearchResult[]>("GET", `/api/search?q=${encodeURIComponent(q)}`),
};

export interface SearchResult {
  id: string;
  title: string;
  icon: string | null;
  type: PageType;
  parent_title: string | null;
  parent_type: PageType | null;
}
