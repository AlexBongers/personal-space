import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { startTestApi, type TestApi } from '../test-utils.js';

let api: TestApi;

beforeEach(async () => {
  api = await startTestApi();
});
afterEach(() => api.close());

describe('page routes', () => {
  it('starts empty and creates pages', async () => {
    expect(await api.get('/api/tree')).toEqual([]);
    const page = await api.post('/api/pages', { title: 'Journal', icon: '📓' });
    expect(page.title).toBe('Journal');
    const tree = await api.get('/api/tree');
    expect(tree).toHaveLength(1);
    expect(tree[0].icon).toBe('📓');
  });

  it('returns a page with its breadcrumb', async () => {
    const root = await api.post('/api/pages', { title: 'Root' });
    const child = await api.post('/api/pages', { parentId: root.id, title: 'Child' });
    const detail = await api.get(`/api/pages/${child.id}`);
    expect(detail.page.title).toBe('Child');
    expect(detail.breadcrumb.map((p: { title: string }) => p.title)).toEqual(['Root']);
  });

  it('renames and deletes with cascade', async () => {
    const root = await api.post('/api/pages', { title: 'Root' });
    const child = await api.post('/api/pages', { parentId: root.id, title: 'Child' });
    expect((await api.patch(`/api/pages/${root.id}`, { title: 'Renamed' })).title).toBe('Renamed');

    const { removed } = await api.del(`/api/pages/${root.id}`);
    expect(new Set(removed)).toEqual(new Set([root.id, child.id]));
    expect(await api.get('/api/tree')).toEqual([]);
  });

  it('reorders siblings', async () => {
    const a = await api.post('/api/pages', { title: 'A' });
    const b = await api.post('/api/pages', { title: 'B' });
    await api.post('/api/pages/reorder', { parentId: null, orderedIds: [b.id, a.id] });
    expect((await api.get('/api/tree')).map((p: { title: string }) => p.title)).toEqual(['B', 'A']);
  });

  it('404s an unknown page and 400s a bad move', async () => {
    expect((await api.raw('GET', '/api/pages/nope')).status).toBe(404);
    const a = await api.post('/api/pages', { title: 'A' });
    expect((await api.raw('PATCH', `/api/pages/${a.id}`, { parentId: a.id })).status).toBe(400);
  });
});
