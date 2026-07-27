import type {
  Block,
  BlockType,
  DatabaseDetail,
  Filter,
  Page,
  PageDetail,
  PageKind,
  PageNode,
  Property,
  PropertyType,
  Row,
  SearchResult,
  SelectOption,
  Sort,
  View,
} from '@shared';

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  keepalive = false,
): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    keepalive,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(detail.error ?? 'Request failed');
  }
  return res.json() as Promise<T>;
}

export interface NewPage {
  parentId?: string | null;
  title?: string;
  icon?: string | null;
  kind?: PageKind;
}

export interface NewBlock {
  id?: string;
  type?: BlockType;
  text?: string;
  checked?: boolean;
  afterId?: string | null;
}

/** Ids are minted client-side so new blocks can render before the round trip. */
export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

export const api = {
  tree: () => request<PageNode[]>('GET', '/tree'),
  page: (id: string) => request<PageDetail>('GET', `/pages/${id}`),
  createPage: (input: NewPage) => request<Page>('POST', '/pages', input),
  updatePage: (id: string, input: { title?: string; icon?: string | null; parentId?: string | null }) =>
    request<Page>('PATCH', `/pages/${id}`, input),
  deletePage: (id: string) => request<{ removed: string[] }>('DELETE', `/pages/${id}`),
  reorderPages: (parentId: string | null, orderedIds: string[]) =>
    request<{ ok: true }>('POST', '/pages/reorder', { parentId, orderedIds }),
  search: (query: string) =>
    request<SearchResult[]>('GET', `/search?q=${encodeURIComponent(query)}`),

  createBlock: (pageId: string, input: NewBlock) =>
    request<Block>('POST', `/pages/${pageId}/blocks`, input),
  updateBlock: (
    id: string,
    input: { type?: BlockType; text?: string; checked?: boolean },
    keepalive = false,
  ) => request<Block>('PATCH', `/blocks/${id}`, input, keepalive),
  deleteBlock: (id: string) => request<{ ok: true }>('DELETE', `/blocks/${id}`),
  reorderBlocks: (pageId: string, orderedIds: string[]) =>
    request<Block[]>('POST', `/pages/${pageId}/blocks/reorder`, { orderedIds }),

  database: (id: string) => request<DatabaseDetail>('GET', `/databases/${id}`),
  createProperty: (databaseId: string, input: { id?: string; name: string; type: PropertyType }) =>
    request<Property>('POST', `/databases/${databaseId}/properties`, input),
  updateProperty: (id: string, input: { name?: string; options?: SelectOption[] }) =>
    request<Property>('PATCH', `/properties/${id}`, input),
  deleteProperty: (id: string) => request<{ ok: true }>('DELETE', `/properties/${id}`),

  createRow: (databaseId: string, input: { id?: string; title?: string; values?: Row['values'] }) =>
    request<Row>('POST', `/databases/${databaseId}/rows`, input),
  updateRow: (id: string, input: { title?: string; values?: Record<string, unknown> }) =>
    request<Row>('PATCH', `/rows/${id}`, input),
  deleteRow: (id: string) => request<{ ok: true }>('DELETE', `/rows/${id}`),

  updateView: (
    id: string,
    input: { filters?: Filter[]; sort?: Sort | null; groupPropertyId?: string | null },
  ) => request<View>('PATCH', `/views/${id}`, input),
};
