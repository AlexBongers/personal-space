import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('api.ts', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('fetchPages calls correct endpoint and returns data', async () => {
    const data = [{ id: '1', title: 'Test' }];
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(data) });
    const { fetchPages } = await import('../src/api');
    const result = await fetchPages();
    expect(mockFetch).toHaveBeenCalledWith('/api/pages');
    expect(result).toEqual(data);
  });

  it('fetchPages throws on error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    const { fetchPages } = await import('../src/api');
    await expect(fetchPages()).rejects.toThrow('Failed to fetch pages');
  });

  it('fetchPage calls correct endpoint and returns data', async () => {
    const data = { id: '1', title: 'Test' };
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(data) });
    const { fetchPage } = await import('../src/api');
    const result = await fetchPage('1');
    expect(mockFetch).toHaveBeenCalledWith('/api/pages/1');
    expect(result).toEqual(data);
  });

  it('fetchPage throws on error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    const { fetchPage } = await import('../src/api');
    await expect(fetchPage('1')).rejects.toThrow('Failed to fetch page');
  });

  it('createPage calls correct endpoint with POST', async () => {
    const data = { id: '2', title: 'New' };
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(data) });
    const { createPage } = await import('../src/api');
    const result = await createPage({ title: 'New' });
    expect(mockFetch).toHaveBeenCalledWith('/api/pages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New' }),
    });
    expect(result).toEqual(data);
  });

  it('createPage throws on error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    const { createPage } = await import('../src/api');
    await expect(createPage({ title: 'New' })).rejects.toThrow('Failed to create page');
  });

  it('updatePage calls correct endpoint with PUT', async () => {
    const data = { id: '1', title: 'Updated' };
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(data) });
    const { updatePage } = await import('../src/api');
    const result = await updatePage('1', { title: 'Updated' });
    expect(mockFetch).toHaveBeenCalledWith('/api/pages/1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Updated' }),
    });
    expect(result).toEqual(data);
  });

  it('updatePage throws on error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    const { updatePage } = await import('../src/api');
    await expect(updatePage('1', { title: 'Updated' })).rejects.toThrow('Failed to update page');
  });

  it('deletePage calls correct endpoint with DELETE', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    const { deletePage } = await import('../src/api');
    await deletePage('1');
    expect(mockFetch).toHaveBeenCalledWith('/api/pages/1', { method: 'DELETE' });
  });

  it('deletePage throws on error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    const { deletePage } = await import('../src/api');
    await expect(deletePage('1')).rejects.toThrow('Failed to delete page');
  });

  it('fetchDatabase calls correct endpoint', async () => {
    const data = { page: { id: 'db1' }, properties: [], rows: [], cells: {} };
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(data) });
    const { fetchDatabase } = await import('../src/api');
    const result = await fetchDatabase('db1');
    expect(mockFetch).toHaveBeenCalledWith('/api/databases/db1');
    expect(result).toEqual(data);
  });

  it('fetchDatabase throws on error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    const { fetchDatabase } = await import('../src/api');
    await expect(fetchDatabase('db1')).rejects.toThrow('Failed to fetch database');
  });

  it('addProperty calls correct endpoint with POST', async () => {
    const data = { id: 'p1', name: 'Status', type: 'select' };
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(data) });
    const { addProperty } = await import('../src/api');
    const result = await addProperty('db1', { name: 'Status', type: 'select' });
    expect(mockFetch).toHaveBeenCalledWith('/api/databases/db1/properties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Status', type: 'select' }),
    });
    expect(result).toEqual(data);
  });

  it('addProperty throws on error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    const { addProperty } = await import('../src/api');
    await expect(addProperty('db1', { name: 'Status', type: 'select' })).rejects.toThrow('Failed to add property');
  });

  it('updateProperty calls correct endpoint with PUT', async () => {
    const data = { id: 'p1', name: 'Updated' };
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(data) });
    const { updateProperty } = await import('../src/api');
    const result = await updateProperty('p1', { name: 'Updated' });
    expect(mockFetch).toHaveBeenCalledWith('/api/properties/p1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated' }),
    });
    expect(result).toEqual(data);
  });

  it('updateProperty throws on error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    const { updateProperty } = await import('../src/api');
    await expect(updateProperty('p1', { name: 'Updated' })).rejects.toThrow('Failed to update property');
  });

  it('deleteProperty calls correct endpoint with DELETE', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    const { deleteProperty } = await import('../src/api');
    await deleteProperty('p1');
    expect(mockFetch).toHaveBeenCalledWith('/api/properties/p1', { method: 'DELETE' });
  });

  it('deleteProperty throws on error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    const { deleteProperty } = await import('../src/api');
    await expect(deleteProperty('p1')).rejects.toThrow('Failed to delete property');
  });

  it('addRow calls correct endpoint with POST', async () => {
    const data = { id: 'r1', title: 'Item' };
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(data) });
    const { addRow } = await import('../src/api');
    const result = await addRow('db1');
    expect(mockFetch).toHaveBeenCalledWith('/api/databases/db1/rows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(result).toEqual(data);
  });

  it('addRow throws on error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    const { addRow } = await import('../src/api');
    await expect(addRow('db1')).rejects.toThrow('Failed to add row');
  });

  it('updateRow calls correct endpoint with PUT', async () => {
    const data = { id: 'r1', title: 'Updated' };
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(data) });
    const { updateRow } = await import('../src/api');
    const result = await updateRow('r1', { title: 'Updated' });
    expect(mockFetch).toHaveBeenCalledWith('/api/rows/r1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Updated' }),
    });
    expect(result).toEqual(data);
  });

  it('updateRow throws on error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    const { updateRow } = await import('../src/api');
    await expect(updateRow('r1', { title: 'Updated' })).rejects.toThrow('Failed to update row');
  });

  it('deleteRow calls correct endpoint with DELETE', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    const { deleteRow } = await import('../src/api');
    await deleteRow('r1');
    expect(mockFetch).toHaveBeenCalledWith('/api/rows/r1', { method: 'DELETE' });
  });

  it('deleteRow throws on error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    const { deleteRow } = await import('../src/api');
    await expect(deleteRow('r1')).rejects.toThrow('Failed to delete row');
  });

  it('updateCell calls correct endpoint with PUT', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    const { updateCell } = await import('../src/api');
    await updateCell('c1', 'new value');
    expect(mockFetch).toHaveBeenCalledWith('/api/cells/c1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: 'new value' }),
    });
  });

  it('updateCell throws on error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    const { updateCell } = await import('../src/api');
    await expect(updateCell('c1', 'value')).rejects.toThrow('Failed to update cell');
  });

  it('batchUpdateCells calls correct endpoint with PUT', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    const { batchUpdateCells } = await import('../src/api');
    await batchUpdateCells('r1', { p1: 'value1' });
    expect(mockFetch).toHaveBeenCalledWith('/api/rows/r1/cells', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ p1: 'value1' }),
    });
  });

  it('batchUpdateCells throws on error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    const { batchUpdateCells } = await import('../src/api');
    await expect(batchUpdateCells('r1', { p1: 'v1' })).rejects.toThrow('Failed to batch update cells');
  });

  it('fetchViewSettings calls correct endpoint', async () => {
    const data = { table: { filters: [], sort: null, groupBy: null } };
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(data) });
    const { fetchViewSettings } = await import('../src/api');
    const result = await fetchViewSettings('db1');
    expect(mockFetch).toHaveBeenCalledWith('/api/databases/db1/views');
    expect(result).toEqual(data);
  });

  it('fetchViewSettings throws on error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    const { fetchViewSettings } = await import('../src/api');
    await expect(fetchViewSettings('db1')).rejects.toThrow('Failed to fetch view settings');
  });

  it('saveViewSettings calls correct endpoint with PUT', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    const { saveViewSettings } = await import('../src/api');
    const settings = { filters: [], sort: null, groupBy: null };
    await saveViewSettings('db1', 'table', settings);
    expect(mockFetch).toHaveBeenCalledWith('/api/databases/db1/views/table', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
  });

  it('saveViewSettings throws on error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    const { saveViewSettings } = await import('../src/api');
    await expect(saveViewSettings('db1', 'table', { filters: [], sort: null, groupBy: null })).rejects.toThrow('Failed to save view settings');
  });

  it('search calls correct endpoint with query param', async () => {
    const data = [{ id: '1', title: 'Result', icon: '', type: 'page' }];
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(data) });
    const { search } = await import('../src/api');
    const result = await search('test');
    expect(mockFetch).toHaveBeenCalledWith('/api/search?q=test');
    expect(result).toEqual(data);
  });

  it('search throws on error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    const { search } = await import('../src/api');
    await expect(search('test')).rejects.toThrow('Failed to search');
  });

  it('fetchTheme calls correct endpoint', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ theme: 'dark' }) });
    const { fetchTheme } = await import('../src/api');
    const result = await fetchTheme();
    expect(mockFetch).toHaveBeenCalledWith('/api/theme');
    expect(result).toBe('dark');
  });

  it('fetchTheme throws on error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    const { fetchTheme } = await import('../src/api');
    await expect(fetchTheme()).rejects.toThrow('Failed to fetch theme');
  });

  it('saveTheme calls correct endpoint with PUT', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    const { saveTheme } = await import('../src/api');
    await saveTheme('dark');
    expect(mockFetch).toHaveBeenCalledWith('/api/theme', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: 'dark' }),
    });
  });

  it('saveTheme throws on error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    const { saveTheme } = await import('../src/api');
    await expect(saveTheme('dark')).rejects.toThrow('Failed to save theme');
  });
});
