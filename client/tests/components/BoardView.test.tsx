import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import BoardView from '../../src/components/BoardView';
import type { DatabaseProperty, DatabaseRow } from '../../src/api';

const selectProp: DatabaseProperty = { id: 'p1', database_id: 'db1', name: 'Status', type: 'select', position: 0, options: [{ id: 'o1', label: 'Active', color: 'blue' }, { id: 'o2', label: 'Inactive', color: 'gray' }], created_at: '' };
const textProp: DatabaseProperty = { id: 'p2', database_id: 'db1', name: 'Notes', type: 'text', position: 1, options: [], created_at: '' };

const rows: DatabaseRow[] = [
  { id: 'r1', database_id: 'db1', title: 'Card 1', position: 0, created_at: '', updated_at: '' },
  { id: 'r2', database_id: 'db1', title: 'Card 2', position: 1, created_at: '', updated_at: '' },
];

const cells = {
  r1: { p1: 'o1' },
  r2: { p1: 'o2' },
};

describe('BoardView', () => {
  it('renders group by selector', () => {
    render(
      <BoardView
        properties={[selectProp, textProp]}
        rows={rows}
        cells={cells}
        groupBy="p1"
        onGroupByChange={() => {}}
        onUpdateCell={() => {}}
      />
    );
    expect(screen.getByText('Group by:')).toBeDefined();
  });

  it('renders columns for each option', () => {
    render(
      <BoardView
        properties={[selectProp, textProp]}
        rows={rows}
        cells={cells}
        groupBy="p1"
        onGroupByChange={() => {}}
        onUpdateCell={() => {}}
      />
    );
    expect(screen.getByText('Active')).toBeDefined();
    expect(screen.getByText('Inactive')).toBeDefined();
  });

  it('shows row cards', () => {
    render(
      <BoardView
        properties={[selectProp, textProp]}
        rows={rows}
        cells={cells}
        groupBy="p1"
        onGroupByChange={() => {}}
        onUpdateCell={() => {}}
      />
    );
    expect(screen.getByText('Card 1')).toBeDefined();
    expect(screen.getByText('Card 2')).toBeDefined();
  });

  it('shows row count per column', () => {
    render(
      <BoardView
        properties={[selectProp, textProp]}
        rows={rows}
        cells={cells}
        groupBy="p1"
        onGroupByChange={() => {}}
        onUpdateCell={() => {}}
      />
    );
    const counts = screen.getAllByText('1');
    expect(counts.length).toBeGreaterThanOrEqual(2);
  });

  it('shows message when no select property exists', () => {
    render(
      <BoardView
        properties={[textProp]}
        rows={rows}
        cells={cells}
        groupBy={null}
        onGroupByChange={() => {}}
        onUpdateCell={() => {}}
      />
    );
    expect(screen.getByText('Add a select property to use board view')).toBeDefined();
  });

  it('renders None option in group by selector', () => {
    render(
      <BoardView
        properties={[selectProp, textProp]}
        rows={rows}
        cells={cells}
        groupBy={null}
        onGroupByChange={() => {}}
        onUpdateCell={() => {}}
      />
    );
    expect(screen.getByText('None')).toBeDefined();
  });

  it('shows ungrouped rows in No value column', () => {
    const rowsWithNoValue: DatabaseRow[] = [
      { id: 'r3', database_id: 'db1', title: 'Unassigned', position: 2, created_at: '', updated_at: '' },
    ];
    render(
      <BoardView
        properties={[selectProp, textProp]}
        rows={rowsWithNoValue}
        cells={{ r3: {} }}
        groupBy="p1"
        onGroupByChange={() => {}}
        onUpdateCell={() => {}}
      />
    );
    expect(screen.getByText('No value')).toBeDefined();
  });
});
