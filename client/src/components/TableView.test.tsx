import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DatabaseDetail } from '@shared';
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

let counter = 0;
vi.mock('../api.ts', () => ({ api, newId: (prefix: string) => `${prefix}_new${++counter}` }));

const status = property('Status', 'select', {
  id: 'pr_status',
  options: [
    { id: 'o_todo', name: 'To do', color: 'amber' },
    { id: 'o_done', name: 'Done', color: 'green' },
  ],
});
const effort = property('Effort', 'number', { id: 'pr_effort' });
const done = property('Done', 'checkbox', { id: 'pr_done' });

function detail(): DatabaseDetail {
  return {
    page: { id: 'db_1', parentId: null, kind: 'database', title: 'Tasks', icon: '✅', position: 0 },
    properties: [status, effort, done],
    rows: [
      row('Ship it', { pr_status: 'o_todo', pr_effort: 3, pr_done: false }, { id: 'rw_1' }),
      row('Test it', { pr_status: 'o_done' }, { id: 'rw_2' }),
    ],
    views: [view('table'), view('board'), view('list')],
  };
}

const onOpenRow = vi.fn();

beforeEach(() => {
  counter = 0;
  for (const fn of Object.values(api)) fn.mockReset().mockResolvedValue({});
  onOpenRow.mockReset();
  render(<DatabaseView detail={detail()} onOpenRow={onOpenRow} />);
});

describe('table view', () => {
  it('renders a column per property and a row per record', () => {
    expect(screen.getByRole('button', { name: 'Column Status' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Column Effort' })).toBeInTheDocument();
    expect(screen.getByTestId('row-Ship it')).toBeInTheDocument();
    expect(screen.getByTestId('row-Test it')).toBeInTheDocument();
    expect(screen.getByText('2 rows')).toBeInTheDocument();
  });

  it('shows the option chip a select cell holds', () => {
    expect(within(screen.getByTestId('cell-Status-Ship it')).getByText('To do')).toBeInTheDocument();
    expect(screen.getByTestId('cell-Status-Test it')).toHaveTextContent('Done');
  });

  it('edits a number cell on blur', async () => {
    const cell = screen.getByRole('spinbutton', { name: 'Effort for Ship it' });
    await userEvent.clear(cell);
    await userEvent.type(cell, '8');
    await userEvent.tab();
    expect(api.updateRow).toHaveBeenCalledWith('rw_1', { values: { pr_effort: '8' } });
  });

  it('leaves a cell alone when the edit is abandoned', async () => {
    const cell = screen.getByRole('spinbutton', { name: 'Effort for Ship it' });
    await userEvent.clear(cell);
    await userEvent.type(cell, '9{Escape}');
    expect(api.updateRow).not.toHaveBeenCalled();
    expect(cell).toHaveValue(3);
  });

  it('toggles a checkbox cell straight away', async () => {
    await userEvent.click(screen.getByRole('checkbox', { name: 'Done for Ship it' }));
    expect(api.updateRow).toHaveBeenCalledWith('rw_1', { values: { pr_done: true } });
  });

  it('picks an existing select option', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Status for Ship it' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Done' }));
    expect(api.updateRow).toHaveBeenCalledWith('rw_1', { values: { pr_status: 'o_done' } });
  });

  it('clears a select cell', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Status for Ship it' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Clear value' }));
    expect(api.updateRow).toHaveBeenCalledWith('rw_1', { values: { pr_status: null } });
  });

  it('creates a new option, colors it, and applies it', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Status for Ship it' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'New Status option' }), 'Blocked');
    await userEvent.click(screen.getByRole('button', { name: /^Add$/ }));

    const [, payload] = api.updateProperty.mock.calls.at(-1)!;
    expect(payload.options.map((o: { name: string }) => o.name)).toEqual(['To do', 'Done', 'Blocked']);
    expect(payload.options[2].color).toBe('purple');
    expect(api.updateRow).toHaveBeenCalledWith('rw_1', { values: { pr_status: 'op_new1' } });
  });

  it('adds a property of a chosen type', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Add property' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'New property name' }), 'Due');
    await userEvent.click(screen.getByRole('button', { name: 'Date' }));
    await userEvent.click(screen.getByRole('button', { name: 'Create property' }));

    expect(api.createProperty).toHaveBeenCalledWith('db_1', {
      id: 'pr_new1',
      name: 'Due',
      type: 'date',
    });
    expect(screen.getByRole('button', { name: 'Column Due' })).toBeInTheDocument();
  });

  it('renames a property', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Column Effort' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Rename property' }));
    const input = screen.getByRole('textbox', { name: 'Property name' });
    await userEvent.clear(input);
    await userEvent.type(input, 'Hours{Enter}');
    expect(api.updateProperty).toHaveBeenCalledWith('pr_effort', { name: 'Hours' });
    expect(screen.getByRole('button', { name: 'Column Hours' })).toBeInTheDocument();
  });

  it('deletes a property only after confirming', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Column Effort' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Delete property' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(api.deleteProperty).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Column Effort' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Delete property' }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(api.deleteProperty).toHaveBeenCalledWith('pr_effort');
    expect(screen.queryByRole('button', { name: 'Column Effort' })).not.toBeInTheDocument();
  });

  it('adds a row', async () => {
    await userEvent.click(screen.getByRole('button', { name: /New row/ }));
    expect(api.createRow).toHaveBeenCalledWith('db_1', {
      id: 'rw_new1',
      title: 'Untitled',
      values: {},
    });
    expect(screen.getByText('3 rows')).toBeInTheDocument();
  });

  it('retitles a row and saves it once typing stops', async () => {
    const title = screen.getByRole('textbox', { name: 'Title of Ship it' });
    await userEvent.clear(title);
    await userEvent.type(title, 'Shipped');
    await waitFor(() => expect(api.updateRow).toHaveBeenCalledWith('rw_1', { title: 'Shipped' }), {
      timeout: 2000,
    });
  });

  it('deletes a row from its menu', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Actions for Test it' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Delete row' }));
    expect(api.deleteRow).toHaveBeenCalledWith('rw_2');
    expect(screen.queryByTestId('row-Test it')).not.toBeInTheDocument();
  });

  it('opens a row as a page', async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Open Ship it' }));
    expect(onOpenRow).toHaveBeenCalledWith('rw_1');
  });
});
