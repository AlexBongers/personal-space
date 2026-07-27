import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SearchResult } from '@shared';
import { QuickFind } from './QuickFind.tsx';

const api = vi.hoisted(() => ({ search: vi.fn() }));
vi.mock('../api.ts', () => ({ api, newId: (p: string) => `${p}_new` }));

const hits: SearchResult[] = [
  { id: 'p1', title: 'Notes', icon: '📓', kind: 'page', parentTitle: null },
  { id: 'p2', title: 'Meeting Notes', icon: '💬', kind: 'page', parentTitle: 'Notes' },
  { id: 'r1', title: 'Note the deadline', icon: null, kind: 'row', parentTitle: 'Tasks' },
];

const onPick = vi.fn();
const onClose = vi.fn();

beforeEach(() => {
  api.search.mockReset().mockResolvedValue(hits);
  onPick.mockReset();
  onClose.mockReset();
  render(<QuickFind onPick={onPick} onClose={onClose} />);
});

describe('QuickFind', () => {
  it('starts empty with a prompt and the search focused', () => {
    expect(screen.getByText(/Start typing to search/)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Search' })).toHaveFocus();
    expect(api.search).not.toHaveBeenCalled();
  });

  it('searches as you type and lists what comes back', async () => {
    await userEvent.type(screen.getByRole('textbox', { name: 'Search' }), 'note');
    await waitFor(() => expect(screen.getByTestId('search-hit-Notes')).toBeInTheDocument());

    expect(api.search).toHaveBeenLastCalledWith('note');
    expect(screen.getByTestId('search-hit-Meeting Notes')).toHaveTextContent('in Notes');
    expect(screen.getByTestId('search-hit-Note the deadline')).toHaveTextContent('Entry');
  });

  it('narrows live as the query changes', async () => {
    const input = screen.getByRole('textbox', { name: 'Search' });
    await userEvent.type(input, 'no');
    await waitFor(() => expect(api.search).toHaveBeenLastCalledWith('no'));

    api.search.mockResolvedValue([hits[1]]);
    await userEvent.type(input, 'te');
    await waitFor(() => expect(screen.queryByTestId('search-hit-Notes')).not.toBeInTheDocument());
    expect(screen.getByTestId('search-hit-Meeting Notes')).toBeInTheDocument();
  });

  it('jumps to a result when it is clicked', async () => {
    await userEvent.type(screen.getByRole('textbox', { name: 'Search' }), 'note');
    await waitFor(() => expect(screen.getByTestId('search-hit-Notes')).toBeInTheDocument());
    await userEvent.click(screen.getByTestId('search-hit-Meeting Notes'));

    expect(onPick).toHaveBeenCalledWith('p2');
    expect(onClose).toHaveBeenCalled();
  });

  it('walks the results with the arrow keys and opens with Enter', async () => {
    const input = screen.getByRole('textbox', { name: 'Search' });
    await userEvent.type(input, 'note');
    await waitFor(() => expect(screen.getByTestId('search-hit-Notes')).toBeInTheDocument());

    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    expect(screen.getByTestId('search-hit-Note the deadline')).toHaveClass('finder__hit--active');
    await userEvent.keyboard('{ArrowUp}');
    expect(screen.getByTestId('search-hit-Meeting Notes')).toHaveClass('finder__hit--active');

    await userEvent.keyboard('{Enter}');
    expect(onPick).toHaveBeenCalledWith('p2');
  });

  it('says so when nothing matches', async () => {
    api.search.mockResolvedValue([]);
    await userEvent.type(screen.getByRole('textbox', { name: 'Search' }), 'zzz');
    await waitFor(() => expect(screen.getByText(/Nothing matches/)).toBeInTheDocument());
  });

  it('closes on Escape and on a click outside', async () => {
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole('dialog').parentElement!);
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
