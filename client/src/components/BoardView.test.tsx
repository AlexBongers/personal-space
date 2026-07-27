import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DatabaseDetail } from '@shared';
import { NO_VALUE, cardMove, groupRows } from '../query.ts';
import { property, row, view } from '../test/factories.ts';
import { DatabaseView } from './DatabaseView.tsx';

const api = vi.hoisted(() => ({
  createProperty: vi.fn(),
  updateProperty: vi.fn(),
  deleteProperty: vi.fn(),
  createRow: vi.fn(),
  updateRow: vi.fn(),
  deleteRow: vi.fn(),
  updateView: vi.fn(),
}));
vi.mock('../api.ts', () => ({ api, newId: (prefix: string) => `${prefix}_new` }));

const status = property('Status', 'select', {
  id: 'p_status',
  options: [
    { id: 'o_todo', name: 'To do', color: 'amber' },
    { id: 'o_done', name: 'Done', color: 'green' },
  ],
});
const owner = property('Owner', 'text', { id: 'p_owner' });

const rows = [
  row('Alpha', { p_status: 'o_todo', p_owner: 'Sam' }, { id: 'r1' }),
  row('Beta', { p_status: 'o_done' }, { id: 'r2' }),
  row('Gamma', {}, { id: 'r3' }),
];

function detail(groupPropertyId: string | null): DatabaseDetail {
  return {
    page: { id: 'db_1', parentId: null, kind: 'database', title: 'Tasks', icon: '✅', position: 0 },
    properties: [status, owner],
    rows,
    views: [
      view('table', { id: 'vw_table' }),
      view('board', { id: 'vw_board', groupPropertyId }),
      view('list', { id: 'vw_list' }),
    ],
  };
}

beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockReset().mockResolvedValue({});
  localStorage.setItem('ps.view.db_1', JSON.stringify('board'));
});

describe('cardMove', () => {
  const grouped = groupRows(rows, status);

  it('moves a card to the column it was dropped on', () => {
    expect(cardMove(rows, status, 'r1', 'o_done')).toEqual({ rowId: 'r1', value: 'o_done' });
    expect(grouped[0].rows.map((r) => r.title)).toEqual(['Alpha']);
  });

  it('clears the value when dropped on the no-value column', () => {
    expect(cardMove(rows, status, 'r1', NO_VALUE)).toEqual({ rowId: 'r1', value: null });
  });

  it('sets the value when a card had none', () => {
    expect(cardMove(rows, status, 'r3', 'o_todo')).toEqual({ rowId: 'r3', value: 'o_todo' });
  });

  it('does nothing for a drop that changes nothing', () => {
    expect(cardMove(rows, status, 'r1', 'o_todo')).toBeNull();
    expect(cardMove(rows, status, 'r3', NO_VALUE)).toBeNull();
    expect(cardMove(rows, status, 'r1', null)).toBeNull();
    expect(cardMove(rows, null, 'r1', 'o_done')).toBeNull();
    expect(cardMove(rows, status, 'gone', 'o_done')).toBeNull();
  });
});

describe('BoardView', () => {
  it('renders one column per option plus a no-value column', () => {
    render(<DatabaseView detail={detail('p_status')} onOpenRow={vi.fn()} />);
    expect(screen.getByTestId('board-view')).toBeInTheDocument();
    for (const name of ['To do', 'Done', 'No value']) {
      expect(screen.getByTestId(`board-column-${name}`)).toBeInTheDocument();
    }
    const todo = screen.getByTestId('board-column-To do');
    expect(within(todo).getByTestId('card-Alpha')).toBeInTheDocument();
    expect(within(todo).getByText('1')).toBeInTheDocument();
  });

  it('shows a card title with a couple of its other properties', () => {
    render(<DatabaseView detail={detail('p_status')} onOpenRow={vi.fn()} />);
    const card = screen.getByTestId('card-Alpha');
    expect(card).toHaveTextContent('Alpha');
    expect(card).toHaveTextContent('Owner');
    expect(card).toHaveTextContent('Sam');
    expect(screen.getByTestId('card-Beta')).not.toHaveTextContent('Owner');
  });

  it('opens a row from its card', async () => {
    const onOpenRow = vi.fn();
    render(<DatabaseView detail={detail('p_status')} onOpenRow={onOpenRow} />);
    await userEvent.click(screen.getByRole('button', { name: 'Alpha' }));
    expect(onOpenRow).toHaveBeenCalledWith('r1');
  });

  it('asks for a grouping property when none is set', () => {
    render(<DatabaseView detail={detail(null)} onOpenRow={vi.fn()} />);
    expect(screen.getByText(/Pick a select property to group by/)).toBeInTheDocument();
  });

  it('changes the grouping property and persists it', async () => {
    render(<DatabaseView detail={detail(null)} onOpenRow={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /^Group/ }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Group by Status' }));

    expect(api.updateView).toHaveBeenCalledWith('vw_board', { groupPropertyId: 'p_status' });
    expect(screen.getByTestId('board-column-To do')).toBeInTheDocument();
  });
});

describe('ListView', () => {
  beforeEach(() => localStorage.setItem('ps.view.db_1', JSON.stringify('list')));

  it('shows each row title with its properties', () => {
    render(<DatabaseView detail={detail('p_status')} onOpenRow={vi.fn()} />);
    const alpha = screen.getByTestId('list-row-Alpha');
    expect(alpha).toHaveTextContent('Alpha');
    expect(alpha).toHaveTextContent('To do');
    expect(alpha).toHaveTextContent('Sam');
  });

  it('opens a row when its line is clicked', async () => {
    const onOpenRow = vi.fn();
    render(<DatabaseView detail={detail('p_status')} onOpenRow={onOpenRow} />);
    await userEvent.click(screen.getByTestId('list-row-Beta'));
    expect(onOpenRow).toHaveBeenCalledWith('r2');
  });
});

describe('view switching and settings', () => {
  it('switches between the three views in place', async () => {
    render(<DatabaseView detail={detail('p_status')} onOpenRow={vi.fn()} />);
    await userEvent.click(screen.getByRole('tab', { name: 'Table' }));
    expect(screen.getByTestId('table-view')).toBeInTheDocument();
    expect(screen.queryByTestId('board-view')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: 'List' }));
    expect(screen.getByTestId('list-view')).toBeInTheDocument();
  });

  it('adds a filter to the current view and narrows the rows', async () => {
    render(<DatabaseView detail={detail('p_status')} onOpenRow={vi.fn()} />);
    await userEvent.click(screen.getByRole('tab', { name: 'Table' }));
    expect(screen.getByTestId('row-count')).toHaveTextContent('3 rows');

    await userEvent.click(screen.getByRole('button', { name: /^Filter/ }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Add filter' }));
    await userEvent.selectOptions(screen.getByLabelText('Filter condition'), 'is');
    await userEvent.selectOptions(screen.getByLabelText('Filter value'), 'o_done');

    expect(screen.getByTestId('row-count')).toHaveTextContent('1 of 3 rows');
    expect(api.updateView).toHaveBeenCalled();
  });

  it('sorts the current view and can reverse it', async () => {
    render(<DatabaseView detail={detail('p_status')} onOpenRow={vi.fn()} />);
    await userEvent.click(screen.getByRole('tab', { name: 'List' }));

    await userEvent.click(screen.getByRole('button', { name: /^Sort/ }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Sort by Name' }));
    expect(screen.getAllByRole('button', { name: /Alpha|Beta|Gamma/ })[0]).toHaveTextContent('Alpha');

    await userEvent.click(screen.getByRole('button', { name: /^Sort/ }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Reverse direction' }));
    expect(screen.getAllByRole('button', { name: /Alpha|Beta|Gamma/ })[0]).toHaveTextContent('Gamma');
  });
});
