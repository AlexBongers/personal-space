import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, newId } from './api.ts';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const lastCall = () => fetchMock.mock.calls.at(-1) as [string, RequestInit];

describe('newId', () => {
  it('makes prefixed, unique ids', () => {
    const a = newId('bl');
    expect(a).toMatch(/^bl_[0-9a-f]{16}$/);
    expect(newId('bl')).not.toBe(a);
  });
});

describe('api', () => {
  it('gets without a body', async () => {
    await api.tree();
    const [url, init] = lastCall();
    expect(url).toBe('/api/tree');
    expect(init.method).toBe('GET');
    expect(init.body).toBeUndefined();
    expect(init.headers).toBeUndefined();
  });

  it('sends JSON on writes', async () => {
    await api.createPage({ title: 'New', kind: 'database' });
    const [url, init] = lastCall();
    expect(url).toBe('/api/pages');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'content-type': 'application/json' });
    expect(JSON.parse(String(init.body))).toEqual({ title: 'New', kind: 'database' });
  });

  it('builds each endpoint from its id', async () => {
    await api.page('pg_1');
    expect(lastCall()[0]).toBe('/api/pages/pg_1');
    await api.deletePage('pg_1');
    expect(lastCall()[1].method).toBe('DELETE');
    await api.updateBlock('bl_1', { text: 'hi' });
    expect(lastCall()[0]).toBe('/api/blocks/bl_1');
    await api.reorderBlocks('pg_1', ['a', 'b']);
    expect(lastCall()[0]).toBe('/api/pages/pg_1/blocks/reorder');
    await api.database('db_1');
    expect(lastCall()[0]).toBe('/api/databases/db_1');
    await api.createProperty('db_1', { name: 'A', type: 'text' });
    expect(lastCall()[0]).toBe('/api/databases/db_1/properties');
    await api.deleteProperty('pr_1');
    expect(lastCall()[0]).toBe('/api/properties/pr_1');
    await api.createRow('db_1', { title: 'R' });
    expect(lastCall()[0]).toBe('/api/databases/db_1/rows');
    await api.updateRow('rw_1', { title: 'R' });
    expect(lastCall()[0]).toBe('/api/rows/rw_1');
    await api.deleteRow('rw_1');
    expect(lastCall()[1].method).toBe('DELETE');
    await api.updateView('vw_1', { sort: null });
    expect(lastCall()[0]).toBe('/api/views/vw_1');
    await api.reorderPages(null, ['a']);
    expect(lastCall()[0]).toBe('/api/pages/reorder');
    await api.createBlock('pg_1', { type: 'todo' });
    expect(lastCall()[0]).toBe('/api/pages/pg_1/blocks');
    await api.updatePage('pg_1', { icon: null });
    expect(lastCall()[1].method).toBe('PATCH');
  });

  it('escapes the search query', async () => {
    await api.search('a & b?');
    expect(lastCall()[0]).toBe('/api/search?q=a%20%26%20b%3F');
  });

  it('marks a keepalive write so it survives the page closing', async () => {
    await api.updateBlock('bl_1', { text: 'bye' }, true);
    expect(lastCall()[1].keepalive).toBe(true);
  });

  it('throws the server error message', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      statusText: 'Bad Request',
      json: async () => ({ error: 'page not found' }),
    });
    await expect(api.page('nope')).rejects.toThrow('page not found');
  });

  it('falls back to the status text when the body is not JSON', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      statusText: 'Server Error',
      json: async () => {
        throw new Error('not json');
      },
    });
    await expect(api.tree()).rejects.toThrow('Server Error');
  });
});
