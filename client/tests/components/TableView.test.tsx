import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TableView from '../../src/components/TableView';
import type { DatabaseProperty, DatabaseRow } from '../../src/api';

const properties: DatabaseProperty[] = [
  { id: 'p1', database_id: 'db1', name: 'Status', type: 'select', position: 0, options: [{ id: 'o1', label: 'Active', color: 'blue' }], created_at: '' },
  { id: 'p2', database_id: 'db1', name: 'Priority', type: 'select', position: 1, options: [{ id: 'o2', label: 'High', color: 'red' }], created_at: '' },
];

const rows: DatabaseRow[] = [
  { id: 'r1', database_id: 'db1', title: 'Item 1', position: 0, created_at: '', updated_at: '' },
  { id: 'r2', database_id: 'db1', title: 'Item 2', position: 1, created_at: '', updated_at: '' },
];

const cells = {
  r1: { p1: '"o1"', p2: '"o2"' },
  r2: { p1: '"o1"' },
};

describe('TableView', () => {
  it('renders table headers from properties', () => {
    render(
      <TableView
        properties={properties}
        rows={rows}
        cells={cells}
        onUpdateCell={() => {}}
        onDeleteRow={() => {}}
        onAddRow={() => {}}
        onRenameRow={() => {}}
        onRenameProperty={() => {}}
      />
    );
    expect(screen.getByText('Status')).toBeDefined();
    expect(screen.getByText('Priority')).toBeDefined();
  });

  it('renders rows', () => {
    render(
      <TableView
        properties={properties}
        rows={rows}
        cells={cells}
        onUpdateCell={() => {}}
        onDeleteRow={() => {}}
        onAddRow={() => {}}
        onRenameRow={() => {}}
        onRenameProperty={() => {}}
      />
    );
    expect(screen.getByText('Item 1')).toBeDefined();
    expect(screen.getByText('Item 2')).toBeDefined();
  });

  it('renders delete buttons for each row', () => {
    render(
      <TableView
        properties={properties}
        rows={rows}
        cells={cells}
        onUpdateCell={() => {}}
        onDeleteRow={() => {}}
        onAddRow={() => {}}
        onRenameRow={() => {}}
        onRenameProperty={() => {}}
      />
    );
    const deleteButtons = screen.getAllByTitle('Delete row');
    expect(deleteButtons).toHaveLength(2);
  });

  it('calls onDeleteRow when delete button clicked', () => {
    const onDeleteRow = vi.fn();
    render(
      <TableView
        properties={properties}
        rows={rows}
        cells={cells}
        onUpdateCell={() => {}}
        onDeleteRow={onDeleteRow}
        onAddRow={() => {}}
        onRenameRow={() => {}}
        onRenameProperty={() => {}}
      />
    );
    const deleteButtons = screen.getAllByTitle('Delete row');
    fireEvent.click(deleteButtons[0]);
    expect(onDeleteRow).toHaveBeenCalledWith('r1');
  });

  it('renders add row button', () => {
    render(
      <TableView
        properties={properties}
        rows={rows}
        cells={cells}
        onUpdateCell={() => {}}
        onDeleteRow={() => {}}
        onAddRow={() => {}}
        onRenameRow={() => {}}
        onRenameProperty={() => {}}
      />
    );
    expect(screen.getByText('+ New')).toBeDefined();
  });

  it('renders type labels in headers', () => {
    render(
      <TableView
        properties={properties}
        rows={rows}
        cells={cells}
        onUpdateCell={() => {}}
        onDeleteRow={() => {}}
        onAddRow={() => {}}
        onRenameRow={() => {}}
        onRenameProperty={() => {}}
      />
    );
    const typeLabels = screen.getAllByText('S');
    expect(typeLabels).toHaveLength(2);
  });

  it('renders title header', () => {
    render(
      <TableView
        properties={properties}
        rows={rows}
        cells={cells}
        onUpdateCell={() => {}}
        onDeleteRow={() => {}}
        onAddRow={() => {}}
        onRenameRow={() => {}}
        onRenameProperty={() => {}}
      />
    );
    expect(screen.getByText('Title')).toBeDefined();
  });
});
