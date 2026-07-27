import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { node } from '../test/factories.ts';
import { Sidebar } from './Sidebar.tsx';

const child = node('Weekly Review');
const tree = [node('Home', [child], { id: 'home' }), node('Projects')];

function renderSidebar(overrides: Partial<Parameters<typeof Sidebar>[0]> = {}) {
  const props = {
    tree,
    activeId: null,
    expanded: new Set<string>(),
    onToggle: vi.fn(),
    onSelect: vi.fn(),
    onCreate: vi.fn(),
    onRename: vi.fn(),
    onRequestDelete: vi.fn(),
    ...overrides,
  };
  render(<Sidebar {...props} />);
  return props;
}

describe('Sidebar', () => {
  it('renders top-level pages with their icons and hides collapsed children', () => {
    renderSidebar();
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Projects')).toBeInTheDocument();
    expect(screen.queryByText('Weekly Review')).not.toBeInTheDocument();
    expect(screen.getByTestId('tree-row-Home')).toHaveTextContent('📄');
  });

  it('shows children when the parent is expanded', () => {
    renderSidebar({ expanded: new Set(['home']) });
    expect(screen.getByText('Weekly Review')).toBeInTheDocument();
  });

  it('toggles a branch from the twisty', async () => {
    const props = renderSidebar();
    await userEvent.click(screen.getByRole('button', { name: 'Expand Home' }));
    expect(props.onToggle).toHaveBeenCalledWith('home');
  });

  it('selects a page when its row is clicked', async () => {
    const props = renderSidebar();
    await userEvent.click(screen.getByText('Projects'));
    expect(props.onSelect).toHaveBeenCalledWith(tree[1].id);
  });

  it('creates a child page from the row plus button', async () => {
    const props = renderSidebar();
    await userEvent.click(screen.getByRole('button', { name: 'Add page inside Home' }));
    expect(props.onCreate).toHaveBeenCalledWith('home', 'page');
  });

  it('creates a top-level page from the footer button', async () => {
    const props = renderSidebar();
    await userEvent.click(screen.getByRole('button', { name: /New page/ }));
    expect(props.onCreate).toHaveBeenCalledWith(null, 'page');
  });

  it('marks the active page', () => {
    renderSidebar({ activeId: 'home' });
    expect(screen.getByTestId('tree-row-Home')).toHaveClass('row--active');
  });

  it('renames a page through the row menu', async () => {
    const props = renderSidebar();
    await userEvent.click(screen.getByRole('button', { name: 'Actions for Home' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));

    const input = screen.getByRole('textbox', { name: 'Page name' });
    await userEvent.clear(input);
    await userEvent.type(input, 'Base{Enter}');
    expect(props.onRename).toHaveBeenCalledWith('home', 'Base');
  });

  it('falls back to Untitled when a rename is emptied', async () => {
    const props = renderSidebar();
    await userEvent.click(screen.getByRole('button', { name: 'Actions for Home' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));

    const input = screen.getByRole('textbox', { name: 'Page name' });
    await userEvent.clear(input);
    await userEvent.type(input, '{Enter}');
    expect(props.onRename).toHaveBeenCalledWith('home', 'Untitled');
  });

  it('abandons a rename on Escape', async () => {
    const props = renderSidebar();
    await userEvent.click(screen.getByRole('button', { name: 'Actions for Home' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Page name' }), 'x{Escape}');
    expect(props.onRename).not.toHaveBeenCalled();
  });

  it('asks to delete through the row menu', async () => {
    const props = renderSidebar();
    await userEvent.click(screen.getByRole('button', { name: 'Actions for Home' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(props.onRequestDelete).toHaveBeenCalledWith(tree[0]);
  });

  it('shows an empty note when there are no pages', () => {
    renderSidebar({ tree: [] });
    expect(screen.getByText('No pages yet.')).toBeInTheDocument();
  });
});
