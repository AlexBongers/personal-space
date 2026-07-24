const API_BASE = '/api';

export interface Page {
  id: string;
  parent_id: string | null;
  title: string;
  icon: string;
  type: 'page' | 'database' | 'row';
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

export async function updatePage(id: string, data: { title?: string; icon?: string }): Promise<Page> {
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