import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PageTreeNode from '../../src/components/PageTreeNode';

const mockNavigate = vi.fn();
const mockRenamePage = vi.fn();
const mockRemovePage = vi.fn();
const mockAddPage = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: '/page/other' }),
  };
});

vi.mock('../../src/store/pages', () => ({
  usePagesStore: Object.assign(
    (selector?: (state: any) => any) => {
      const state = {
        pages: [],
        renamePage: mockRenamePage,
        removePage: mockRemovePage,
        addPage: mockAddPage,
      };
      return selector ? selector(state) : state;
    },
    { setState: vi.fn(), getState: vi.fn(), subscribe: vi.fn(), destroy: vi.fn() }
  ),
}));

function renderTreeNode(page: any, depth = 0) {
  return render(
    <MemoryRouter>
      <PageTreeNode page={page} depth={depth} />
    </MemoryRouter>
  );
}

describe('PageTreeNode', () => {
  it('renders page title', () => {
    renderTreeNode({ id: '1', title: 'My Page', icon: '', type: 'page', children: [], parent_id: null, created_at: '', updated_at: '', content: null });
    expect(screen.getByText('My Page')).toBeDefined();
  });

  it('renders default icon when no icon provided', () => {
    renderTreeNode({ id: '1', title: 'Page', icon: '', type: 'page', children: [], parent_id: null, created_at: '', updated_at: '', content: null });
    expect(screen.getByText('📄')).toBeDefined();
  });

  it('renders custom icon when provided', () => {
    renderTreeNode({ id: '1', title: 'Page', icon: '🚀', type: 'page', children: [], parent_id: null, created_at: '', updated_at: '', content: null });
    expect(screen.getByText('🚀')).toBeDefined();
  });

  it('does not show expand chevron for pages without children', () => {
    renderTreeNode({ id: '1', title: 'Page', icon: '', type: 'page', children: [], parent_id: null, created_at: '', updated_at: '', content: null });
    expect(screen.queryByText('▶')).toBeNull();
  });

  it('shows expand chevron for pages with children', () => {
    renderTreeNode({ id: '1', title: 'Page', icon: '', type: 'page', children: [{ id: '2', title: 'Child', icon: '', type: 'page', children: [], parent_id: '1', created_at: '', updated_at: '', content: null }], parent_id: null, created_at: '', updated_at: '', content: null });
    expect(screen.getByText('▶')).toBeDefined();
  });

  it('clicking on page navigates to /page/{id}', () => {
    renderTreeNode({ id: '42', title: 'My Page', icon: '', type: 'page', children: [], parent_id: null, created_at: '', updated_at: '', content: null });
    fireEvent.click(screen.getByText('My Page'));
    expect(mockNavigate).toHaveBeenCalledWith('/page/42');
  });

  it('double-clicking starts rename', () => {
    renderTreeNode({ id: '1', title: 'My Page', icon: '', type: 'page', children: [], parent_id: null, created_at: '', updated_at: '', content: null });
    fireEvent.dblClick(screen.getByText('My Page'));
    const input = screen.getByDisplayValue('My Page');
    expect(input).toBeDefined();
  });

  it('shows context menu on right-click', () => {
    renderTreeNode({ id: '1', title: 'My Page', icon: '', type: 'page', children: [], parent_id: null, created_at: '', updated_at: '', content: null });
    fireEvent.contextMenu(screen.getByText('My Page'));
    expect(screen.getByText('Rename')).toBeDefined();
    expect(screen.getByText('New sub-page')).toBeDefined();
    expect(screen.getByText('Delete')).toBeDefined();
  });

  it('shows delete confirmation dialog when clicking Delete in context menu', () => {
    renderTreeNode({ id: '1', title: 'My Page', icon: '', type: 'page', children: [], parent_id: null, created_at: '', updated_at: '', content: null });
    fireEvent.contextMenu(screen.getByText('My Page'));
    fireEvent.click(screen.getByText('Delete'));
    expect(screen.getByText('Cancel')).toBeDefined();
    expect(screen.getByText('This page will be permanently deleted. This cannot be undone.')).toBeDefined();
  });
});
