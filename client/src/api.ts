const API_BASE = '/api';

export interface Page {
  id: string;
  parent_id: string | null;
  title: string;
  icon: string;
  type: 'page' | 'database' | 'row';
  content: any;
  created_at: string;
  updated_at: string;
  children: Page[];
}

export async function fetchPages(): Promise<Page[]> {
  const res = await fetch(`${API_BASE}/pages`);
  if (!res.ok) throw new Error('Failed to fetch pages');
  return res.json();
}

export async function fetchPage(id: string): Promise<Page> {
  const res = await fetch(`${API_BASE}/pages/${id}`);
  if (!res.ok) throw new Error('Failed to fetch page');
  return res.json();
}

export async function createPage(data: { title?: string; icon?: string; parent_id?: string; type?: string }): Promise<Page> {
  const res = await fetch(`${API_BASE}/pages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create page');
  return res.json();
}

export async function updatePage(id: string, data: { title?: string; icon?: string; content?: any }): Promise<Page> {
  const res = await fetch(`${API_BASE}/pages/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update page');
  return res.json();
}

export async function deletePage(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/pages/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete page');
}

export interface DatabaseProperty {
  id: string;
  database_id: string;
  name: string;
  type: 'text' | 'number' | 'select' | 'multi_select' | 'date' | 'checkbox' | 'url';
  position: number;
  options: { id: string; label: string; color: string }[];
  created_at: string;
}

export interface DatabaseRow {
  id: string;
  database_id: string;
  title: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface DatabaseData {
  page: Page;
  properties: DatabaseProperty[];
  rows: DatabaseRow[];
  cells: { [rowId: string]: { [propId: string]: any } };
}

export async function fetchDatabase(id: string): Promise<DatabaseData> {
  const res = await fetch(`${API_BASE}/databases/${id}`);
  if (!res.ok) throw new Error('Failed to fetch database');
  return res.json();
}

export async function addProperty(databaseId: string, data: { name: string; type: string; options?: any[] }): Promise<DatabaseProperty> {
  const res = await fetch(`${API_BASE}/databases/${databaseId}/properties`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to add property');
  return res.json();
}

export async function updateProperty(id: string, data: { name?: string; options?: any[] }): Promise<DatabaseProperty> {
  const res = await fetch(`${API_BASE}/properties/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update property');
  return res.json();
}

export async function deleteProperty(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/properties/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete property');
}

export async function addRow(databaseId: string, data?: { title?: string }): Promise<DatabaseRow> {
  const res = await fetch(`${API_BASE}/databases/${databaseId}/rows`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data || {}),
  });
  if (!res.ok) throw new Error('Failed to add row');
  return res.json();
}

export async function updateRow(id: string, data: { title?: string }): Promise<DatabaseRow> {
  const res = await fetch(`${API_BASE}/rows/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update row');
  return res.json();
}

export async function deleteRow(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/rows/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete row');
}

export async function updateCell(id: string, value: any): Promise<void> {
  const res = await fetch(`${API_BASE}/cells/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value }),
  });
  if (!res.ok) throw new Error('Failed to update cell');
}

export async function batchUpdateCells(rowId: string, cells: { [propertyId: string]: any }): Promise<void> {
  const res = await fetch(`${API_BASE}/rows/${rowId}/cells`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cells),
  });
  if (!res.ok) throw new Error('Failed to batch update cells');
}

export interface Filter {
  propertyId: string;
  operator: string;
  value: any;
}

export interface Sort {
  propertyId: string;
  direction: 'asc' | 'desc';
}

export interface ViewSettings {
  filters: Filter[];
  sort: Sort | null;
  groupBy: string | null;
}

export async function fetchViewSettings(databaseId: string): Promise<{ [viewType: string]: ViewSettings }> {
  const res = await fetch(`${API_BASE}/databases/${databaseId}/views`);
  if (!res.ok) throw new Error('Failed to fetch view settings');
  return res.json();
}

export async function saveViewSettings(databaseId: string, viewType: string, settings: ViewSettings): Promise<void> {
  const res = await fetch(`${API_BASE}/databases/${databaseId}/views/${viewType}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error('Failed to save view settings');
}

export interface SearchResult {
  id: string;
  title: string;
  icon: string;
  type: 'page' | 'database' | 'row';
}

export async function search(q: string): Promise<SearchResult[]> {
  const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error('Failed to search');
  return res.json();
}

export async function fetchTheme(): Promise<string> {
  const res = await fetch(`${API_BASE}/theme`);
  if (!res.ok) throw new Error('Failed to fetch theme');
  const data = await res.json();
  return data.theme;
}

export async function saveTheme(theme: string): Promise<void> {
  const res = await fetch(`${API_BASE}/theme`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ theme }),
  });
  if (!res.ok) throw new Error('Failed to save theme');
}