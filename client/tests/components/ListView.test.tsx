import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import ListView from '../../src/components/ListView';
import type { DatabaseProperty, DatabaseRow } from '../../src/api';

const properties: DatabaseProperty[] = [
  { id: 'p1', database_id: 'db-1', name: 'Title', type: 'text', position: 0, options: [], created_at: '' },
];

const rows: DatabaseRow[] = [
  { id: 'row-1', database_id: 'db-1', title: 'First Row', position: 0, created_at: '', updated_at: '' },
  { id: 'row-2', database_id: 'db-1', title: 'Second Row', position: 1, created_at: '', updated_at: '' },
];

const cells = {
  'row-1': { p1: 'Some text value' },
  'row-2': { p1: 'Another value' },
};

function renderListView() {
  return render(
    <BrowserRouter>
      <ListView properties={properties} rows={rows} cells={cells} />
    </BrowserRouter>
  );
}

describe('ListView', () => {
  it('renders rows', () => {
    renderListView();
    expect(screen.getByText('First Row')).toBeDefined();
    expect(screen.getByText('Second Row')).toBeDefined();
  });

  it('shows title for each row', () => {
    renderListView();
    expect(screen.getByText('First Row')).toBeDefined();
    expect(screen.getByText('Second Row')).toBeDefined();
  });

  it('shows first property value', () => {
    renderListView();
    expect(screen.getByText('Some text value')).toBeDefined();
    expect(screen.getByText('Another value')).toBeDefined();
  });

  it('shows empty state when no rows', () => {
    render(
      <BrowserRouter>
        <ListView properties={properties} rows={[]} cells={{}} />
      </BrowserRouter>
    );
    expect(screen.getByText('No rows yet')).toBeDefined();
  });

  it('does not show value if first property value is empty', () => {
    render(
      <BrowserRouter>
        <ListView properties={properties} rows={rows} cells={{ 'row-1': {}, 'row-2': { p1: '' } }} />
      </BrowserRouter>
    );
    const firstRowEl = screen.getByText('First Row').closest('div');
    const valueEl = firstRowEl?.querySelector('span:last-child');
    expect(valueEl?.textContent).not.toBe('');
  });
});
