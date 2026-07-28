import { Page, Block, Database, Property, Row, SelectOption, View, Filter } from "shared/types";

const BASE = "/api";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export function getPages(): Promise<Page[]> {
  return request<Page[]>("/pages");
}

export function getPage(id: string): Promise<Page> {
  return request<Page>(`/pages/${id}`);
}

export function createPage(data: { title: string; parentId?: string | null; icon?: string | null }): Promise<Page> {
  return request<Page>("/pages", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updatePage(id: string, data: Partial<Page>): Promise<Page> {
  return request<Page>(`/pages/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deletePage(id: string): Promise<void> {
  return request<void>(`/pages/${id}`, { method: "DELETE" });
}

export function getBlocks(pageId: string): Promise<Block[]> {
  return request<Block[]>(`/pages/${pageId}/blocks`);
}

export function createBlock(pageId: string, data: { type: Block["type"]; content?: string; position?: number }): Promise<Block> {
  return request<Block>(`/pages/${pageId}/blocks`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateBlock(id: string, data: Partial<Block>): Promise<Block> {
  return request<Block>(`/blocks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteBlock(id: string): Promise<void> {
  return request<void>(`/blocks/${id}`, { method: "DELETE" });
}

export function reorderBlocks(blocks: { id: string; position: number }[]): Promise<void> {
  return request<void>("/blocks/reorder", {
    method: "PATCH",
    body: JSON.stringify({ blocks }),
  });
}

export function createDatabase(data: { pageId: string; name?: string; properties?: Property[] }): Promise<Database> {
  return request<Database>("/databases", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function getDatabase(id: string): Promise<Database> {
  return request<Database>(`/databases/${id}`);
}

export function getDatabaseByPage(pageId: string): Promise<Database> {
  return request<Database>(`/databases/by-page/${pageId}`);
}

export function updateDatabase(id: string, data: Partial<Database>): Promise<Database> {
  return request<Database>(`/databases/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function getRows(databaseId: string): Promise<Row[]> {
  return request<Row[]>(`/databases/${databaseId}/rows`);
}

export function createRow(databaseId: string, data: { title?: string; data?: Record<string, unknown> }): Promise<Row> {
  return request<Row>(`/databases/${databaseId}/rows`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateRow(id: string, data: Partial<Row>): Promise<Row> {
  return request<Row>(`/databases/rows/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteRow(id: string): Promise<void> {
  return request<void>(`/databases/rows/${id}`, { method: "DELETE" });
}

export function updateProperties(databaseId: string, properties: Property[]): Promise<Database> {
  return request<Database>(`/databases/${databaseId}/properties`, {
    method: "PATCH",
    body: JSON.stringify({ properties }),
  });
}

export function addSelectOption(databaseId: string, data: { propertyId: string; value: string; color: string }): Promise<SelectOption> {
  return request<SelectOption>(`/databases/${databaseId}/select-options`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateSelectOption(id: string, data: Partial<SelectOption>): Promise<SelectOption> {
  return request<SelectOption>(`/databases/select-options/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteSelectOption(id: string): Promise<void> {
  return request<void>(`/databases/select-options/${id}`, { method: "DELETE" });
}

export function getRowByRowId(rowId: string): Promise<Row> {
  return request<Row>(`/databases/by-row/${rowId}`);
}

export function getViews(databaseId: string): Promise<View[]> {
  return request<View[]>(`/databases/${databaseId}/views`);
}

export function createView(databaseId: string, data: Partial<View>): Promise<View> {
  return request<View>(`/databases/${databaseId}/views`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateView(id: string, data: Partial<View>): Promise<View> {
  return request<View>(`/databases/views/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteView(id: string): Promise<void> {
  return request<void>(`/databases/views/${id}`, { method: "DELETE" });
}

export function getFilteredRows(databaseId: string, params: { sortField?: string; sortDir?: string; filter?: string }): Promise<Row[]> {
  const searchParams = new URLSearchParams();
  if (params.sortField) searchParams.set("sortField", params.sortField);
  if (params.sortDir) searchParams.set("sortDir", params.sortDir);
  if (params.filter) searchParams.set("filter", params.filter);
  const qs = searchParams.toString();
  return request<Row[]>(`/databases/${databaseId}/rows${qs ? `?${qs}` : ""}`);
}

export interface SearchResult {
  id: string;
  title: string;
  type: "page" | "row";
  icon: string;
  parentChain: { id: string; title: string }[];
}

export function search(q: string): Promise<SearchResult[]> {
  return request<SearchResult[]>(`/search?q=${encodeURIComponent(q)}`);
}

export function getSetting(key: string): Promise<{ value: string | null }> {
  return request<{ value: string | null }>(`/settings/${key}`);
}

export function updateSetting(key: string, value: string): Promise<{ key: string; value: string }> {
  return request<{ key: string; value: string }>("/settings", {
    method: "PATCH",
    body: JSON.stringify({ key, value }),
  });
}
