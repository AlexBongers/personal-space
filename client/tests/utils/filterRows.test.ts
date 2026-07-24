import { describe, it, expect } from 'vitest';
import { filterRows, sortRows } from '../../src/utils/filterRows';
import type { DatabaseRow, DatabaseProperty, Filter, Sort } from '../../src/api';

const textProp: DatabaseProperty = { id: 'p1', database_id: 'db1', name: 'Name', type: 'text', position: 0, options: [], created_at: '' };
const numberProp: DatabaseProperty = { id: 'p2', database_id: 'db1', name: 'Age', type: 'number', position: 1, options: [], created_at: '' };
const selectProp: DatabaseProperty = { id: 'p3', database_id: 'db1', name: 'Status', type: 'select', position: 2, options: [
  { id: 'opt1', label: 'Active', color: 'green' },
  { id: 'opt2', label: 'Inactive', color: 'gray' },
], created_at: '' };
const multiSelectProp: DatabaseProperty = { id: 'p4', database_id: 'db1', name: 'Tags', type: 'multi_select', position: 3, options: [
  { id: 'tag1', label: 'Urgent', color: 'red' },
  { id: 'tag2', label: 'Important', color: 'blue' },
], created_at: '' };
const checkboxProp: DatabaseProperty = { id: 'p5', database_id: 'db1', name: 'Done', type: 'checkbox', position: 4, options: [], created_at: '' };
const dateProp: DatabaseProperty = { id: 'p6', database_id: 'db1', name: 'Due', type: 'date', position: 5, options: [], created_at: '' };
const urlProp: DatabaseProperty = { id: 'p7', database_id: 'db1', name: 'Link', type: 'url', position: 6, options: [], created_at: '' };

const properties = [textProp, numberProp, selectProp, multiSelectProp, checkboxProp, dateProp, urlProp];

const row1: DatabaseRow = { id: 'r1', database_id: 'db1', title: 'Alice', position: 0, created_at: '', updated_at: '' };
const row2: DatabaseRow = { id: 'r2', database_id: 'db1', title: 'Bob', position: 1, created_at: '', updated_at: '' };
const row3: DatabaseRow = { id: 'r3', database_id: 'db1', title: 'Charlie', position: 2, created_at: '', updated_at: '' };
const row4: DatabaseRow = { id: 'r4', database_id: 'db1', title: 'Diana', position: 3, created_at: '', updated_at: '' };

const rows = [row1, row2, row3, row4];

const cells = {
  r1: { p1: 'Alice', p2: 30, p3: 'opt1', p4: ['tag1'], p5: true, p6: '2026-01-15', p7: 'https://alice.com' },
  r2: { p1: 'Bob', p2: 25, p3: 'opt2', p4: ['tag2'], p5: false, p6: '2026-03-20', p7: 'https://bob.com' },
  r3: { p1: 'Charlie', p2: 35, p3: 'opt1', p4: ['tag1', 'tag2'], p5: true, p6: '2026-02-10', p7: 'https://charlie.com' },
  r4: { p1: 'Diana', p2: 28, p3: 'opt2', p4: [], p5: false, p6: '2026-04-05', p7: 'https://diana.com' },
};

describe('filterRows', () => {
  it('returns all rows when no filters', () => {
    expect(filterRows(rows, cells, properties, [])).toEqual(rows);
  });

  it('filters by text contains', () => {
    const filters: Filter[] = [{ propertyId: 'p1', operator: 'contains', value: 'Ali' }];
    expect(filterRows(rows, cells, properties, filters)).toEqual([row1]);
  });

  it('filters by text contains (case insensitive)', () => {
    const filters: Filter[] = [{ propertyId: 'p1', operator: 'contains', value: 'alice' }];
    expect(filterRows(rows, cells, properties, filters)).toEqual([row1]);
  });

  it('filters by number equals', () => {
    const filters: Filter[] = [{ propertyId: 'p2', operator: 'equals', value: 25 }];
    expect(filterRows(rows, cells, properties, filters)).toEqual([row2]);
  });

  it('filters by number greater than', () => {
    const filters: Filter[] = [{ propertyId: 'p2', operator: 'greater than', value: 30 }];
    expect(filterRows(rows, cells, properties, filters)).toEqual([row3]);
  });

  it('filters by number less than', () => {
    const filters: Filter[] = [{ propertyId: 'p2', operator: 'less than', value: 30 }];
    expect(filterRows(rows, cells, properties, filters)).toEqual([row2, row4]);
  });

  it('filters by select is', () => {
    const filters: Filter[] = [{ propertyId: 'p3', operator: 'is', value: 'opt1' }];
    expect(filterRows(rows, cells, properties, filters)).toEqual([row1, row3]);
  });

  it('filters by select is not', () => {
    const filters: Filter[] = [{ propertyId: 'p3', operator: 'is not', value: 'opt1' }];
    expect(filterRows(rows, cells, properties, filters)).toEqual([row2, row4]);
  });

  it('filters by multi_select contains', () => {
    const filters: Filter[] = [{ propertyId: 'p4', operator: 'contains', value: 'tag1' }];
    expect(filterRows(rows, cells, properties, filters)).toEqual([row1, row3]);
  });

  it('filters by multi_select does not contain', () => {
    const filters: Filter[] = [{ propertyId: 'p4', operator: 'does not contain', value: 'tag1' }];
    expect(filterRows(rows, cells, properties, filters)).toEqual([row2, row4]);
  });

  it('filters by checkbox is checked', () => {
    const filters: Filter[] = [{ propertyId: 'p5', operator: 'is checked', value: '' }];
    expect(filterRows(rows, cells, properties, filters)).toEqual([row1, row3]);
  });

  it('filters by checkbox is not checked', () => {
    const filters: Filter[] = [{ propertyId: 'p5', operator: 'is not checked', value: '' }];
    expect(filterRows(rows, cells, properties, filters)).toEqual([row2, row4]);
  });

  it('filters by date before', () => {
    const filters: Filter[] = [{ propertyId: 'p6', operator: 'before', value: '2026-02-01' }];
    expect(filterRows(rows, cells, properties, filters)).toEqual([row1]);
  });

  it('filters by date after', () => {
    const filters: Filter[] = [{ propertyId: 'p6', operator: 'after', value: '2026-03-01' }];
    expect(filterRows(rows, cells, properties, filters)).toEqual([row2, row4]);
  });

  it('filters by url contains', () => {
    const filters: Filter[] = [{ propertyId: 'p7', operator: 'contains', value: 'bob' }];
    expect(filterRows(rows, cells, properties, filters)).toEqual([row2]);
  });

  it('combines multiple filters with AND', () => {
    const filters: Filter[] = [
      { propertyId: 'p3', operator: 'is', value: 'opt1' },
      { propertyId: 'p5', operator: 'is checked', value: '' },
    ];
    expect(filterRows(rows, cells, properties, filters)).toEqual([row1, row3]);
  });

  it('returns empty when no rows match', () => {
    const filters: Filter[] = [{ propertyId: 'p1', operator: 'contains', value: 'Zzz' }];
    expect(filterRows(rows, cells, properties, filters)).toEqual([]);
  });

  it('handles unknown property gracefully', () => {
    const filters: Filter[] = [{ propertyId: 'nonexistent', operator: 'contains', value: 'x' }];
    expect(filterRows(rows, cells, properties, filters)).toEqual(rows);
  });
});

describe('sortRows', () => {
  it('returns rows unchanged when sort is null', () => {
    expect(sortRows(rows, cells, properties, null)).toEqual(rows);
  });

  it('sorts by text ascending', () => {
    const sort: Sort = { propertyId: 'p1', direction: 'asc' };
    const result = sortRows(rows, cells, properties, sort);
    expect(result.map(r => r.title)).toEqual(['Alice', 'Bob', 'Charlie', 'Diana']);
  });

  it('sorts by text descending', () => {
    const sort: Sort = { propertyId: 'p1', direction: 'desc' };
    const result = sortRows(rows, cells, properties, sort);
    expect(result.map(r => r.title)).toEqual(['Diana', 'Charlie', 'Bob', 'Alice']);
  });

  it('sorts by number ascending', () => {
    const sort: Sort = { propertyId: 'p2', direction: 'asc' };
    const result = sortRows(rows, cells, properties, sort);
    expect(result.map(r => r.title)).toEqual(['Bob', 'Diana', 'Alice', 'Charlie']);
  });

  it('sorts by number descending', () => {
    const sort: Sort = { propertyId: 'p2', direction: 'desc' };
    const result = sortRows(rows, cells, properties, sort);
    expect(result.map(r => r.title)).toEqual(['Charlie', 'Alice', 'Diana', 'Bob']);
  });

  it('sorts by select label ascending', () => {
    const sort: Sort = { propertyId: 'p3', direction: 'asc' };
    const result = sortRows(rows, cells, properties, sort);
    // Active (opt1) comes before Inactive (opt2)
    expect(result.map(r => r.title)).toEqual(['Alice', 'Charlie', 'Bob', 'Diana']);
  });

  it('sorts by date ascending', () => {
    const sort: Sort = { propertyId: 'p6', direction: 'asc' };
    const result = sortRows(rows, cells, properties, sort);
    expect(result.map(r => r.title)).toEqual(['Alice', 'Charlie', 'Bob', 'Diana']);
  });

  it('sorts by checkbox ascending', () => {
    const sort: Sort = { propertyId: 'p5', direction: 'asc' };
    const result = sortRows(rows, cells, properties, sort);
    // false (Bob, Diana) before true (Alice, Charlie)
    expect(result[0].title).toBe('Bob');
    expect(result[1].title).toBe('Diana');
  });

  it('puts rows with null values at the end', () => {
    const cellsWithNull = {
      ...cells,
      r1: { ...cells.r1, p1: null },
    };
    const sort: Sort = { propertyId: 'p1', direction: 'asc' };
    const result = sortRows(rows, cellsWithNull, properties, sort);
    expect(result[result.length - 1].title).toBe('Alice');
  });
});