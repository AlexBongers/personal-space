import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SortControl from '../../src/components/SortControl';
import type { DatabaseProperty, Sort } from '../../src/api';

const properties: DatabaseProperty[] = [
  { id: 'prop-1', database_id: 'db-1', name: 'Name', type: 'text', position: 0, options: [], created_at: '' },
  { id: 'prop-2', database_id: 'db-1', name: 'Status', type: 'select', position: 1, options: [], created_at: '' },
];

describe('SortControl', () => {
  it('renders property selector', () => {
    render(<SortControl properties={properties} sort={null} onChange={() => {}} />);
    expect(screen.getByText('No sort')).toBeDefined();
    expect(screen.getByText('Name')).toBeDefined();
    expect(screen.getByText('Status')).toBeDefined();
  });

  it('renders direction toggle when sort is active', () => {
    const sort: Sort = { propertyId: 'prop-1', direction: 'asc' };
    render(<SortControl properties={properties} sort={sort} onChange={() => {}} />);
    expect(screen.getByText('Asc')).toBeDefined();
  });

  it('hides direction toggle when sort is null', () => {
    render(<SortControl properties={properties} sort={null} onChange={() => {}} />);
    expect(screen.queryByText('Asc')).toBeNull();
    expect(screen.queryByText('Desc')).toBeNull();
  });

  it('calls onChange when a property is selected', () => {
    const onChange = vi.fn();
    render(<SortControl properties={properties} sort={null} onChange={onChange} />);
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'prop-1' } });
    expect(onChange).toHaveBeenCalledWith({ propertyId: 'prop-1', direction: 'asc' });
  });

  it('calls onChange with null when "No sort" is selected', () => {
    const sort: Sort = { propertyId: 'prop-1', direction: 'asc' };
    const onChange = vi.fn();
    render(<SortControl properties={properties} sort={sort} onChange={onChange} />);
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('toggles direction when direction button is clicked', () => {
    const sort: Sort = { propertyId: 'prop-1', direction: 'asc' };
    const onChange = vi.fn();
    render(<SortControl properties={properties} sort={sort} onChange={onChange} />);
    fireEvent.click(screen.getByTitle('Ascending'));
    expect(onChange).toHaveBeenCalledWith({ propertyId: 'prop-1', direction: 'desc' });
  });
});
