import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import RowPage from '../../src/components/RowPage';

vi.mock('../../src/api', () => ({
  fetchPage: vi.fn().mockResolvedValue({ id: 'r1', parent_id: 'db1', title: 'Test Row', icon: 'file', type: 'row', content: null, created_at: '', updated_at: '', children: [] }),
  fetchDatabase: vi.fn().mockResolvedValue({
    page: { id: 'db1', parent_id: null, title: 'Test DB', icon: 'db', type: 'database', content: null, created_at: '', updated_at: '', children: [] },
    properties: [{ id: 'p1', database_id: 'db1', name: 'Status', type: 'select', position: 0, options: [{ id: 'o1', label: 'Active', color: 'blue' }] }],
    rows: [{ id: 'r1', database_id: 'db1', title: 'Test Row', position: 0, created_at: '', updated_at: '' }],
    cells: { r1: { p1: '"o1"' } },
  }),
}));

describe('RowPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    render(
      <BrowserRouter>
        <RowPage pageId="r1" />
      </BrowserRouter>
    );
    expect(screen.getByText('Loading...')).toBeDefined();
  });

  it('renders property values after loading', async () => {
    render(
      <BrowserRouter>
        <RowPage pageId="r1" />
      </BrowserRouter>
    );
    expect(await screen.findByText('Status')).toBeDefined();
  });

  it('renders page title', async () => {
    render(
      <BrowserRouter>
        <RowPage pageId="r1" />
      </BrowserRouter>
    );
    expect(await screen.findByText('Test Row')).toBeDefined();
  });

  it('renders page icon', async () => {
    render(
      <BrowserRouter>
        <RowPage pageId="r1" />
      </BrowserRouter>
    );
    expect(await screen.findByText('file')).toBeDefined();
  });

  it('renders PageEditor for blocks', async () => {
    render(
      <BrowserRouter>
        <RowPage pageId="r1" />
      </BrowserRouter>
    );
    await screen.findByText('Status');
    expect(screen.getByLabelText).toBeDefined();
  });
});
