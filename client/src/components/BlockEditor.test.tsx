import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Block } from '@shared';
import { block } from '../test/factories.ts';
import { BlockEditor, ordinalFor, typeAfter } from './BlockEditor.tsx';

const api = vi.hoisted(() => ({
  createBlock: vi.fn(),
  updateBlock: vi.fn(),
  deleteBlock: vi.fn(),
  reorderBlocks: vi.fn(),
}));

vi.mock('../api.ts', () => ({
  api,
  newId: (prefix: string) => `${prefix}_new`,
}));

beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockReset().mockResolvedValue({});
});

function editor(blocks: Block[]) {
  render(<BlockEditor pageId="pg_1" initial={blocks} />);
}

const textbox = (name: string) => screen.getByRole('textbox', { name });

describe('ordinalFor', () => {
  it('numbers a run of numbered blocks from one', () => {
    const blocks = [
      block('paragraph', 'intro'),
      block('numbered', 'one'),
      block('numbered', 'two'),
      block('numbered', 'three'),
    ];
    expect([1, 2, 3].map((i) => ordinalFor(blocks, i))).toEqual([1, 2, 3]);
  });

  it('restarts after a non-numbered block', () => {
    const blocks = [block('numbered', 'a'), block('paragraph', 'break'), block('numbered', 'b')];
    expect(ordinalFor(blocks, 2)).toBe(1);
  });
});

describe('typeAfter', () => {
  it('continues lists and otherwise drops to a paragraph', () => {
    expect(typeAfter(block('bulleted'))).toBe('bulleted');
    expect(typeAfter(block('numbered'))).toBe('numbered');
    expect(typeAfter(block('todo'))).toBe('todo');
    expect(typeAfter(block('heading1'))).toBe('paragraph');
    expect(typeAfter(block('paragraph'))).toBe('paragraph');
  });
});

describe('BlockEditor', () => {
  it('renders each block type with its own shape', () => {
    editor([
      block('heading1', 'Title', { id: 'b1' }),
      block('todo', 'Task', { id: 'b2', checked: true }),
      block('divider', '', { id: 'b3' }),
      block('numbered', 'Step', { id: 'b4' }),
    ]);
    expect(screen.getByTestId('block-b1')).toHaveAttribute('data-block-type', 'heading1');
    expect(screen.getByRole('checkbox', { name: 'To-do: Task' })).toBeChecked();
    expect(screen.getByLabelText('Divider block')).toBeInTheDocument();
    expect(screen.getByTestId('block-b4')).toHaveTextContent('1.');
  });

  it('saves edited text after the debounce', async () => {
    editor([block('paragraph', 'Hello', { id: 'b1' })]);
    await userEvent.click(textbox('Text block'));
    await userEvent.type(textbox('Text block'), ' there');

    await waitFor(() => expect(api.updateBlock).toHaveBeenCalled(), { timeout: 2000 });
    const [id, payload] = api.updateBlock.mock.calls.at(-1)!;
    expect(id).toBe('b1');
    expect(payload.text).toContain('there');
  });

  it('adds a block below on Enter and keeps the list type', async () => {
    editor([block('bulleted', 'One', { id: 'b1' })]);
    await userEvent.click(textbox('Bulleted list block'));
    await userEvent.keyboard('{Enter}');

    expect(api.createBlock).toHaveBeenCalledWith('pg_1', {
      id: 'bl_new',
      type: 'bulleted',
      afterId: 'b1',
    });
    expect(screen.getAllByRole('textbox', { name: 'Bulleted list block' })).toHaveLength(2);
  });

  it('removes an empty block on Backspace', async () => {
    editor([block('paragraph', 'Keep', { id: 'b1' }), block('paragraph', '', { id: 'b2' })]);
    const empty = screen.getByTestId('block-text-b2');
    await userEvent.click(empty);
    await userEvent.keyboard('{Backspace}');

    expect(api.deleteBlock).toHaveBeenCalledWith('b2');
    expect(screen.queryByTestId('block-b2')).not.toBeInTheDocument();
  });

  it('leaves a non-empty block alone on Backspace', async () => {
    editor([block('paragraph', 'Words', { id: 'b1' })]);
    await userEvent.click(textbox('Text block'));
    await userEvent.keyboard('{Backspace}');
    expect(api.deleteBlock).not.toHaveBeenCalled();
  });

  it('toggles a to-do and persists it', async () => {
    editor([block('todo', 'Task', { id: 'b1' })]);
    await userEvent.click(screen.getByRole('checkbox', { name: 'To-do: Task' }));
    expect(api.updateBlock).toHaveBeenCalledWith('b1', { checked: true });
    expect(screen.getByRole('checkbox', { name: 'To-do: Task' })).toBeChecked();
  });

  it('opens the slash menu, filters it, and inserts the chosen block', async () => {
    editor([block('paragraph', '', { id: 'b1' })]);
    const field = screen.getByTestId('block-text-b1');
    await userEvent.click(field);
    await userEvent.keyboard('/');
    expect(screen.getByTestId('slash-menu')).toBeInTheDocument();
    expect(screen.getAllByRole('menuitem')).toHaveLength(11);

    await userEvent.keyboard('quo');
    expect(screen.getAllByRole('menuitem')).toHaveLength(1);

    await userEvent.keyboard('{Enter}');
    expect(screen.queryByTestId('slash-menu')).not.toBeInTheDocument();
    expect(screen.getByTestId('block-b1')).toHaveAttribute('data-block-type', 'quote');
    expect(api.updateBlock).toHaveBeenCalledWith('b1', { type: 'quote', text: '' });
  });

  it('closes the slash menu on Escape', async () => {
    editor([block('paragraph', '', { id: 'b1' })]);
    await userEvent.click(screen.getByTestId('block-text-b1'));
    await userEvent.keyboard('/');
    expect(screen.getByTestId('slash-menu')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByTestId('slash-menu')).not.toBeInTheDocument();
  });

  it('does not open the slash menu mid-word', async () => {
    editor([block('paragraph', 'and', { id: 'b1' })]);
    const field = screen.getByTestId('block-text-b1');
    await userEvent.click(field);
    await userEvent.type(field, '/or');
    expect(screen.queryByTestId('slash-menu')).not.toBeInTheDocument();
  });

  it('changes a block type from the block menu', async () => {
    editor([block('paragraph', 'Note', { id: 'b1' })]);
    await userEvent.click(screen.getByLabelText(/Block options and drag handle/));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Callout' }));

    expect(api.updateBlock).toHaveBeenCalledWith('b1', { type: 'callout' });
    expect(screen.getByTestId('block-b1')).toHaveAttribute('data-block-type', 'callout');
  });

  it('deletes a block from the block menu', async () => {
    editor([block('paragraph', 'Gone', { id: 'b1' })]);
    await userEvent.click(screen.getByLabelText(/Block options and drag handle/));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Delete block' }));

    expect(api.deleteBlock).toHaveBeenCalledWith('b1');
    expect(screen.queryByTestId('block-b1')).not.toBeInTheDocument();
  });

  it('appends a block from the trailing click target', async () => {
    editor([]);
    await userEvent.click(screen.getByRole('button', { name: 'Add a block' }));
    expect(api.createBlock).toHaveBeenCalledWith('pg_1', {
      id: 'bl_new',
      type: 'paragraph',
      afterId: null,
    });
  });

  it('inserts a divider and follows it with a paragraph to type into', async () => {
    editor([block('paragraph', '', { id: 'b1' })]);
    await userEvent.click(screen.getByTestId('block-text-b1'));
    await userEvent.keyboard('/divider');
    await userEvent.keyboard('{Enter}');

    expect(screen.getByTestId('block-b1')).toHaveAttribute('data-block-type', 'divider');
    expect(screen.getByTestId('block-bl_new')).toHaveAttribute('data-block-type', 'paragraph');
  });
});
