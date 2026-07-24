import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usePagesStore } from '../../src/store/pages';
import * as api from '../../src/api';

vi.mock('../../src/api', () => ({
  fetchPages: vi.fn(),
  createPage: vi.fn(),
  updatePage: vi.fn(),
  deletePage: vi.fn(),
}));

const mockPages: api.Page[] = [
  {
    id: '1',
    parent_id: null,
    title: 'Home',
    icon: 'home',
    type: 'page',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    children: [],
  },
  {
    id: '2',
    parent_id: null,
    title: 'Notes',
    icon: 'file',
    type: 'page',
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
    children: [],
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  usePagesStore.setState({ pages: [], loading: false, error: null });
});

describe('usePagesStore', () => {
  it('loads pages successfully', async () => {
    vi.mocked(api.fetchPages).mockResolvedValue(mockPages);

    await usePagesStore.getState().loadPages();

    const state = usePagesStore.getState();
    expect(state.pages).toEqual(mockPages);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('handles loadPages error', async () => {
    vi.mocked(api.fetchPages).mockRejectedValue(new Error('Network error'));

    await usePagesStore.getState().loadPages();

    const state = usePagesStore.getState();
    expect(state.pages).toEqual([]);
    expect(state.loading).toBe(false);
    expect(state.error).toBe('Network error');
  });

  it('adds a page and reloads', async () => {
    const newPage: api.Page = {
      id: '3',
      parent_id: null,
      title: 'New',
      icon: 'plus',
      type: 'page',
      created_at: '2024-01-03T00:00:00Z',
      updated_at: '2024-01-03T00:00:00Z',
      children: [],
    };
    vi.mocked(api.createPage).mockResolvedValue(newPage);
    vi.mocked(api.fetchPages).mockResolvedValue([...mockPages, newPage]);

    const result = await usePagesStore.getState().addPage({ title: 'New' });

    expect(result).toEqual(newPage);
    expect(api.createPage).toHaveBeenCalledWith({ title: 'New' });
    expect(usePagesStore.getState().pages).toContainEqual(newPage);
  });

  it('renames a page and reloads', async () => {
    vi.mocked(api.updatePage).mockResolvedValue({ ...mockPages[0], title: 'Updated' });
    vi.mocked(api.fetchPages).mockResolvedValue(mockPages);

    await usePagesStore.getState().renamePage('1', 'Updated');

    expect(api.updatePage).toHaveBeenCalledWith('1', { title: 'Updated' });
  });

  it('changes page icon and reloads', async () => {
    vi.mocked(api.updatePage).mockResolvedValue({ ...mockPages[0], icon: 'star' });
    vi.mocked(api.fetchPages).mockResolvedValue(mockPages);

    await usePagesStore.getState().changeIcon('1', 'star');

    expect(api.updatePage).toHaveBeenCalledWith('1', { icon: 'star' });
  });

  it('removes a page and reloads', async () => {
    vi.mocked(api.deletePage).mockResolvedValue(undefined);
    vi.mocked(api.fetchPages).mockResolvedValue(mockPages);

    await usePagesStore.getState().removePage('1');

    expect(api.deletePage).toHaveBeenCalledWith('1');
  });
});