import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Page, PageDetail, PageNode } from '@shared';
import App from './App.tsx';
import { block, node, property, row, view } from './test/factories.ts';

const api = vi.hoisted(() => ({
  tree: vi.fn(),
  page: vi.fn(),
  createPage: vi.fn(),
  updatePage: vi.fn(),
  deletePage: vi.fn(),
  search: vi.fn(),
  createBlock: vi.fn(),
  updateBlock: vi.fn(),
  deleteBlock: vi.fn(),
  reorderBlocks: vi.fn(),
  updateRow: vi.fn(),
  updateProperty: vi.fn(),
  createProperty: vi.fn(),
  deleteProperty: vi.fn(),
  createRow: vi.fn(),
  deleteRow: vi.fn(),
  updateView: vi.fn(),
}));
vi.mock('./api.ts', () => ({ api, newId: (prefix: string) => `${prefix}_new` }));

const home = node('Home', [node('Inbox', [], { id: 'inbox', parentId: 'home' })], { id: 'home' });
const life = node('Life', [], { id: 'life' });
const tasks = node('Tasks', [], { id: 'tasks', kind: 'database', icon: '✅' });

const page = (id: string, title: string, kind: Page['kind'] = 'page'): Page => ({
  id,
  parentId: null,
  kind,
  title,
  icon: '📄',
  position: 0,
});

function detailFor(id: string): PageDetail {
  if (id === 'tasks') {
    return {
      page: page('tasks', 'Tasks', 'database'),
      blocks: [],
      breadcrumb: [],
      row: null,
      database: {
        page: page('tasks', 'Tasks', 'database'),
        properties: [property('Status', 'select', { id: 'p_status' })],
        rows: [row('Ship it', {}, { id: 'r1' })],
        views: [
          view('table', { id: 'v_t' }),
          view('board', { id: 'v_b' }),
          view('list', { id: 'v_l' }),
        ],
      },
    };
  }
  if (id === 'r1') {
    return {
      page: { ...page('r1', 'Ship it', 'row'), parentId: 'tasks' },
      blocks: [],
      breadcrumb: [page('tasks', 'Tasks', 'database')],
      database: null,
      row: { values: { p_status: null }, properties: [property('Notes', 'text', { id: 'p_notes' })] },
    };
  }
  const titles: Record<string, string> = { home: 'Home', inbox: 'Inbox', life: 'Life' };
  return {
    page: page(id, titles[id] ?? 'Untitled'),
    blocks: [block('paragraph', `Body of ${titles[id] ?? id}`, { id: `b_${id}` })],
    breadcrumb: id === 'inbox' ? [page('home', 'Home')] : [],
    database: null,
    row: null,
  };
}

let tree: PageNode[];

beforeEach(() => {
  window.location.hash = '';
  tree = [home, life, tasks];
  for (const fn of Object.values(api)) fn.mockReset().mockResolvedValue({});
  api.tree.mockImplementation(async () => tree);
  api.page.mockImplementation(async (id: string) => detailFor(id));
  api.createPage.mockImplementation(async (input: { kind?: string }) =>
    page('new', input.kind === 'database' ? 'Untitled database' : 'Untitled', 'page'),
  );
  api.deletePage.mockResolvedValue({ removed: ['life'] });
  api.search.mockResolvedValue([]);
});

const ready = () => waitFor(() => expect(screen.getByTestId('tree-row-Home')).toBeInTheDocument());

describe('App', () => {
  it('loads the tree and opens the first page', async () => {
    render(<App />);
    await ready();
    expect(screen.getByTestId('tree-row-Life')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('page-title')).toHaveTextContent('Home'));
    expect(screen.getByText('Body of Home')).toBeInTheDocument();
  });

  it('navigates when a sidebar page is chosen', async () => {
    render(<App />);
    await ready();
    await userEvent.click(screen.getByText('Life'));
    await waitFor(() => expect(screen.getByTestId('page-title')).toHaveTextContent('Life'));
    expect(window.location.hash).toBe('#/p/life');
  });

  it('reveals the open page by expanding its ancestors', async () => {
    window.location.hash = '#/p/inbox';
    render(<App />);
    await ready();
    await waitFor(() => expect(screen.getByTestId('tree-row-Inbox')).toBeInTheDocument());
  });

  it('creates a page and a database from the sidebar', async () => {
    render(<App />);
    await ready();

    await userEvent.click(screen.getByRole('button', { name: /New page/ }));
    await waitFor(() =>
      expect(api.createPage).toHaveBeenCalledWith({
        parentId: null,
        kind: 'page',
        title: 'Untitled',
        icon: '📄',
      }),
    );

    await userEvent.click(screen.getByRole('button', { name: /New database/ }));
    await waitFor(() =>
      expect(api.createPage).toHaveBeenLastCalledWith({
        parentId: null,
        kind: 'database',
        title: 'Untitled database',
        icon: '🗄️',
      }),
    );
  });

  it('renames a page from the sidebar', async () => {
    render(<App />);
    await ready();
    await userEvent.click(screen.getByRole('button', { name: 'Actions for Life' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));
    const input = screen.getByRole('textbox', { name: 'Page name' });
    await userEvent.clear(input);
    await userEvent.type(input, 'Living{Enter}');
    await waitFor(() => expect(api.updatePage).toHaveBeenCalledWith('life', { title: 'Living' }));
  });

  it('saves an edited page title after typing stops', async () => {
    render(<App />);
    await ready();
    const title = screen.getByTestId('page-title');
    await userEvent.click(title);
    await userEvent.type(title, '!');
    await waitFor(() => expect(api.updatePage).toHaveBeenCalledWith('home', { title: 'Home!' }), {
      timeout: 2000,
    });
  });

  it('changes the page icon', async () => {
    render(<App />);
    await ready();
    await userEvent.click(screen.getByRole('button', { name: 'Change page icon' }));
    await userEvent.click(screen.getByRole('button', { name: 'Icon 🔥' }));
    await waitFor(() => expect(api.updatePage).toHaveBeenCalledWith('home', { icon: '🔥' }));
  });

  it('removes an icon from the picker', async () => {
    render(<App />);
    await ready();
    await userEvent.click(screen.getByRole('button', { name: 'Change page icon' }));
    await userEvent.click(screen.getByRole('button', { name: 'Remove icon' }));
    await waitFor(() => expect(api.updatePage).toHaveBeenCalledWith('home', { icon: null }));
  });

  it('deletes a page only after confirming, and warns about nested pages', async () => {
    render(<App />);
    await ready();

    await userEvent.click(screen.getByRole('button', { name: 'Actions for Home' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('1 nested page');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(api.deletePage).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Actions for Life' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('cannot be undone');
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(api.deletePage).toHaveBeenCalledWith('life'));
  });

  it('collapses and expands a branch', async () => {
    render(<App />);
    await ready();
    await userEvent.click(screen.getByRole('button', { name: 'Expand Home' }));
    expect(screen.getByTestId('tree-row-Inbox')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Collapse Home' }));
    expect(screen.queryByTestId('tree-row-Inbox')).not.toBeInTheDocument();
  });

  it('shows a database page as a table, and a row as its own page', async () => {
    render(<App />);
    await ready();
    await userEvent.click(screen.getByText('Tasks'));
    await waitFor(() => expect(screen.getByTestId('table-view')).toBeInTheDocument());
    expect(screen.queryByTestId('block-editor')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Open Ship it' }));
    await waitFor(() => expect(screen.getByTestId('row-properties')).toBeInTheDocument());
    expect(screen.getByRole('textbox', { name: 'Notes for this entry' })).toBeInTheDocument();
  });

  it('walks up from a row through its breadcrumb', async () => {
    window.location.hash = '#/p/r1';
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('row-properties')).toBeInTheDocument());
    await userEvent.click(
      within(screen.getByRole('navigation', { name: 'Breadcrumb' })).getByRole('button'),
    );
    await waitFor(() => expect(screen.getByTestId('table-view')).toBeInTheDocument());
  });

  it('edits a row property from its page', async () => {
    window.location.hash = '#/p/r1';
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('row-properties')).toBeInTheDocument());
    const field = screen.getByRole('textbox', { name: 'Notes for this entry' });
    await userEvent.type(field, 'Late');
    await userEvent.tab();
    await waitFor(() =>
      expect(api.updateRow).toHaveBeenCalledWith('r1', { values: { p_notes: 'Late' } }),
    );
  });

  it('opens quick find from the control and from the shortcut', async () => {
    render(<App />);
    await ready();

    await userEvent.click(screen.getByRole('button', { name: /Search/ }));
    expect(screen.getByRole('dialog', { name: 'Quick find' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Quick find' })).not.toBeInTheDocument(),
    );

    await userEvent.keyboard('{Meta>}k{/Meta}');
    expect(screen.getByRole('dialog', { name: 'Quick find' })).toBeInTheDocument();
  });

  it('jumps to a search result', async () => {
    api.search.mockResolvedValue([
      { id: 'life', title: 'Life', icon: '🌿', kind: 'page', parentTitle: null },
    ]);
    render(<App />);
    await ready();

    await userEvent.keyboard('{Control>}k{/Control}');
    await userEvent.type(screen.getByRole('textbox', { name: 'Search' }), 'life');
    await waitFor(() => expect(screen.getByTestId('search-hit-Life')).toBeInTheDocument());
    await userEvent.click(screen.getByTestId('search-hit-Life'));

    await waitFor(() => expect(screen.getByTestId('page-title')).toHaveTextContent('Life'));
    expect(screen.queryByRole('dialog', { name: 'Quick find' })).not.toBeInTheDocument();
  });

  it('toggles the theme and remembers it', async () => {
    render(<App />);
    await ready();
    expect(document.documentElement.dataset.theme).toBe('light');

    await userEvent.click(screen.getByRole('button', { name: 'Switch to dark mode' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('ps.theme')).toBe('"dark"');

    await userEvent.click(screen.getByRole('button', { name: 'Switch to light mode' }));
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('says so when nothing is selected', async () => {
    window.location.hash = '#/p/gone';
    api.page.mockRejectedValue(new Error('page not found'));
    render(<App />);
    await waitFor(() => expect(screen.getByText('Nothing selected')).toBeInTheDocument());
  });
});
