import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import PageEditor from '../../src/components/PageEditor';
import * as api from '../../src/api';

vi.mock('../../src/api', () => ({
  fetchPage: vi.fn(),
  updatePage: vi.fn(),
}));

describe('PageEditor component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.fetchPage).mockResolvedValue({
      id: '1',
      parent_id: null,
      title: 'Test',
      icon: 'file',
      type: 'page',
      content: { type: 'doc', content: [{ type: 'paragraph' }] },
      created_at: '',
      updated_at: '',
      children: [],
    });
  });

  it('renders without crashing', () => {
    const { container } = render(<PageEditor pageId="1" />);
    expect(container).toBeTruthy();
  });
});

describe('api.ts URL construction', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  it('constructs correct API URLs and methods', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });

    const realApi = await vi.importActual<typeof api>('../../src/api');

    await realApi.fetchPage('page-123');
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/pages/page-123');

    await realApi.updatePage('page-123', { title: 'New Title' });
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/pages/page-123', expect.objectContaining({
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New Title' }),
    }));

    await realApi.createPage({ title: 'New Page', parent_id: null });
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/pages', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ title: 'New Page', parent_id: null }),
    }));

    await realApi.deletePage('page-123');
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/pages/page-123', expect.objectContaining({
      method: 'DELETE',
    }));
  });

  it('handles fetch errors gracefully', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({ ok: false });

    const realApi = await vi.importActual<typeof api>('../../src/api');

    await expect(realApi.fetchPage('x')).rejects.toThrow('Failed to fetch page');
    await expect(realApi.updatePage('x', {})).rejects.toThrow('Failed to update page');
  });
});
