import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FilterBar from '../../src/components/FilterBar';
import type { DatabaseProperty, Filter } from '../../src/api';

const textProp: DatabaseProperty = { id: 'p1', database_id: 'db-1', name: 'Title', type: 'text', position: 0, options: [], created_at: '' };
const selectProp: DatabaseProperty = { id: 'p2', database_id: 'db-1', name: 'Status', type: 'select', position: 1, options: [{ id: 'opt-1', label: 'Done', color: 'green' }], created_at: '' };

const properties = [textProp, selectProp];

describe('FilterBar', () => {
  it('renders add filter button', () => {
    render(<FilterBar properties={properties} filters={[]} onChange={() => {}} />);
    expect(screen.getByText('+ Add filter')).toBeDefined();
  });

  it('does not render when properties is empty', () => {
    const { container } = render(<FilterBar properties={[]} filters={[]} onChange={() => {}} />);
    expect(container.innerHTML).toBe('');
  });

  it('can add a filter row', () => {
    const onChange = vi.fn();
    render(<FilterBar properties={properties} filters={[]} onChange={onChange} />);
    fireEvent.click(screen.getByText('+ Add filter'));
    expect(onChange).toHaveBeenCalledWith([
      { propertyId: 'p1', operator: 'contains', value: '' },
    ]);
  });

  it('can remove a filter row', () => {
    const filters: Filter[] = [
      { propertyId: 'p1', operator: 'contains', value: 'hello' },
    ];
    const onChange = vi.fn();
    render(<FilterBar properties={properties} filters={filters} onChange={onChange} />);
    const removeButton = screen.getByTitle('Remove filter');
    fireEvent.click(removeButton);
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('shows operator selector for each filter', () => {
    const filters: Filter[] = [
      { propertyId: 'p1', operator: 'contains', value: '' },
    ];
    render(<FilterBar properties={properties} filters={filters} onChange={() => {}} />);
    expect(screen.getByDisplayValue('Contains')).toBeDefined();
  });

  it('changes operators when a different property type is selected', () => {
    const filters: Filter[] = [
      { propertyId: 'p1', operator: 'contains', value: '' },
    ];
    const onChange = vi.fn();
    render(<FilterBar properties={properties} filters={filters} onChange={onChange} />);
    const propertySelect = screen.getAllByRole('combobox')[0];
    fireEvent.change(propertySelect, { target: { value: 'p2' } });
    expect(onChange).toHaveBeenCalledWith([
      { propertyId: 'p2', operator: 'is', value: '' },
    ]);
  });

  it('shows filter value input for select type', () => {
    const filters: Filter[] = [
      { propertyId: 'p2', operator: 'is', value: '' },
    ];
    render(<FilterBar properties={properties} filters={filters} onChange={() => {}} />);
    expect(screen.getByText('--')).toBeDefined();
  });
});
