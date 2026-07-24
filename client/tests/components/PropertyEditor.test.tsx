import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PropertyEditor from '../../src/components/PropertyEditor';
import type { DatabaseProperty } from '../../src/api';

const options = [{ id: '1', label: 'Option 1', color: 'blue' as string }];

const textProp: DatabaseProperty = { id: 'p1', database_id: 'db-1', name: 'Text', type: 'text', position: 0, options: [], created_at: '' };
const checkboxProp: DatabaseProperty = { id: 'p2', database_id: 'db-1', name: 'Checkbox', type: 'checkbox', position: 1, options: [], created_at: '' };
const dateProp: DatabaseProperty = { id: 'p3', database_id: 'db-1', name: 'Date', type: 'date', position: 2, options: [], created_at: '' };
const numberProp: DatabaseProperty = { id: 'p4', database_id: 'db-1', name: 'Number', type: 'number', position: 3, options: [], created_at: '' };
const selectProp: DatabaseProperty = { id: 'p5', database_id: 'db-1', name: 'Select', type: 'select', position: 4, options, created_at: '' };
const multiSelectProp: DatabaseProperty = { id: 'p6', database_id: 'db-1', name: 'MultiSelect', type: 'multi_select', position: 5, options, created_at: '' };

describe('PropertyEditor', () => {
  it('renders text input for text type', () => {
    render(<PropertyEditor property={textProp} value="" onChange={() => {}} />);
    const input = screen.getByRole('textbox');
    expect(input).toBeDefined();
  });

  it('renders checkbox for checkbox type', () => {
    render(<PropertyEditor property={checkboxProp} value={false} onChange={() => {}} />);
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeDefined();
  });

  it('renders date input for date type', () => {
    render(<PropertyEditor property={dateProp} value="" onChange={() => {}} />);
    const input = screen.getByDisplayValue('');
    expect(input).toBeDefined();
  });

  it('renders number input for number type', () => {
    render(<PropertyEditor property={numberProp} value={42} onChange={() => {}} />);
    const input = screen.getByDisplayValue('42');
    expect(input).toBeDefined();
  });

  it('renders select dropdown for select type with options', () => {
    render(<PropertyEditor property={selectProp} value="" onChange={() => {}} />);
    expect(screen.getByText('Option 1')).toBeDefined();
  });

  it('renders multi-select with chips for multi_select type', () => {
    render(<PropertyEditor property={multiSelectProp} value={[]} onChange={() => {}} />);
    expect(screen.getByText('Option 1')).toBeDefined();
  });

  it('calls onChange when value changes', () => {
    const onChange = vi.fn();
    render(<PropertyEditor property={textProp} value="" onChange={onChange} />);
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'new value' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith('new value');
  });
});
