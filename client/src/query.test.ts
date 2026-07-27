import { describe, expect, it } from 'vitest';
import type { Filter, FilterOperator } from '@shared';
import {
  TITLE_KEY,
  applyFilters,
  applySort,
  applyView,
  groupRows,
  isUnary,
  operatorsFor,
} from './query.ts';
import { property, row } from './test/factories.ts';

const status = property('Status', 'select', {
  id: 'p_status',
  options: [
    { id: 'o_todo', name: 'To do', color: 'amber' },
    { id: 'o_doing', name: 'Doing', color: 'blue' },
    { id: 'o_done', name: 'Done', color: 'green' },
  ],
});
const tags = property('Tags', 'multi_select', {
  id: 'p_tags',
  options: [
    { id: 'o_home', name: 'Home', color: 'amber' },
    { id: 'o_work', name: 'Work', color: 'blue' },
  ],
});
const notes = property('Notes', 'text', { id: 'p_notes' });
const due = property('Due', 'date', { id: 'p_due' });
const effort = property('Effort', 'number', { id: 'p_effort' });
const flag = property('Flag', 'checkbox', { id: 'p_flag' });

const properties = [status, tags, notes, due, effort, flag];

const rows = [
  row(
    'Alpha',
    { p_status: 'o_todo', p_tags: ['o_home'], p_notes: 'buy milk', p_due: '2026-01-10', p_effort: 3, p_flag: true },
    { id: 'r1' },
  ),
  row(
    'Beta',
    { p_status: 'o_done', p_tags: ['o_work', 'o_home'], p_notes: 'ship it', p_due: '2026-03-01', p_effort: 1 },
    { id: 'r2' },
  ),
  row('Gamma', { p_status: 'o_doing', p_notes: 'plan', p_due: '2026-02-01', p_effort: 9, p_flag: false }, { id: 'r3' }),
  row('Delta', {}, { id: 'r4' }),
];

const filter = (propertyId: string, operator: FilterOperator, value: unknown = null): Filter => ({
  id: 'f1',
  propertyId,
  operator,
  value: value as Filter['value'],
});

const titles = (list: typeof rows) => list.map((r) => r.title);

describe('operatorsFor', () => {
  it('offers operators that suit each type', () => {
    expect(operatorsFor('text')).toEqual(['contains', 'not_contains']);
    expect(operatorsFor('url')).toEqual(['contains', 'not_contains']);
    expect(operatorsFor('select')).toEqual(['is', 'is_not']);
    expect(operatorsFor('multi_select')).toEqual(['is', 'is_not']);
    expect(operatorsFor('checkbox')).toEqual(['is_checked', 'is_not_checked']);
    expect(operatorsFor('date')).toEqual(['before', 'after']);
    expect(operatorsFor('number')).toEqual(['is', 'is_not']);
  });

  it('knows which operators take no value', () => {
    expect(isUnary('is_checked')).toBe(true);
    expect(isUnary('is_not_checked')).toBe(true);
    expect(isUnary('contains')).toBe(false);
  });
});

describe('applyFilters', () => {
  it('filters text with contains and its negation', () => {
    expect(titles(applyFilters(rows, properties, [filter('p_notes', 'contains', 'milk')]))).toEqual([
      'Alpha',
    ]);
    expect(
      titles(applyFilters(rows, properties, [filter('p_notes', 'not_contains', 'milk')])),
    ).toEqual(['Beta', 'Gamma', 'Delta']);
  });

  it('is case-insensitive on text', () => {
    expect(titles(applyFilters(rows, properties, [filter('p_notes', 'contains', 'MILK')]))).toEqual([
      'Alpha',
    ]);
  });

  it('filters a select with is and is not', () => {
    expect(titles(applyFilters(rows, properties, [filter('p_status', 'is', 'o_done')]))).toEqual([
      'Beta',
    ]);
    expect(titles(applyFilters(rows, properties, [filter('p_status', 'is_not', 'o_done')]))).toEqual([
      'Alpha',
      'Gamma',
      'Delta',
    ]);
  });

  it('filters a multi-select by whether it holds the option', () => {
    expect(titles(applyFilters(rows, properties, [filter('p_tags', 'is', 'o_work')]))).toEqual([
      'Beta',
    ]);
    expect(titles(applyFilters(rows, properties, [filter('p_tags', 'is', 'o_home')]))).toEqual([
      'Alpha',
      'Beta',
    ]);
  });

  it('filters a checkbox by its state', () => {
    expect(titles(applyFilters(rows, properties, [filter('p_flag', 'is_checked')]))).toEqual([
      'Alpha',
    ]);
    expect(titles(applyFilters(rows, properties, [filter('p_flag', 'is_not_checked')]))).toEqual([
      'Beta',
      'Gamma',
      'Delta',
    ]);
  });

  it('filters dates before and after, excluding empty ones', () => {
    expect(titles(applyFilters(rows, properties, [filter('p_due', 'before', '2026-02-15')]))).toEqual(
      ['Alpha', 'Gamma'],
    );
    expect(titles(applyFilters(rows, properties, [filter('p_due', 'after', '2026-02-15')]))).toEqual([
      'Beta',
    ]);
  });

  it('filters numbers by equality', () => {
    expect(titles(applyFilters(rows, properties, [filter('p_effort', 'is', '9')]))).toEqual(['Gamma']);
    expect(titles(applyFilters(rows, properties, [filter('p_effort', 'is_not', '9')]))).toEqual([
      'Alpha',
      'Beta',
      'Delta',
    ]);
  });

  it('combines several filters with AND', () => {
    const result = applyFilters(rows, properties, [
      { ...filter('p_notes', 'contains', 'i'), id: 'a' },
      { ...filter('p_status', 'is', 'o_done'), id: 'b' },
    ]);
    expect(titles(result)).toEqual(['Beta']);
  });

  it('ignores incomplete filters and unknown properties', () => {
    expect(applyFilters(rows, properties, [])).toBe(rows);
    expect(applyFilters(rows, properties, [filter('p_notes', 'contains', null)])).toBe(rows);
    expect(applyFilters(rows, properties, [filter('gone', 'contains', 'x')])).toBe(rows);
  });
});

describe('applySort', () => {
  it('sorts by number in both directions, empties last', () => {
    expect(titles(applySort(rows, properties, { propertyId: 'p_effort', direction: 'asc' }))).toEqual([
      'Beta',
      'Alpha',
      'Gamma',
      'Delta',
    ]);
    expect(
      titles(applySort(rows, properties, { propertyId: 'p_effort', direction: 'desc' })),
    ).toEqual(['Gamma', 'Alpha', 'Beta', 'Delta']);
  });

  it('sorts a select by the order of its options', () => {
    expect(titles(applySort(rows, properties, { propertyId: 'p_status', direction: 'asc' }))).toEqual(
      ['Alpha', 'Gamma', 'Beta', 'Delta'],
    );
  });

  it('sorts dates and text', () => {
    expect(titles(applySort(rows, properties, { propertyId: 'p_due', direction: 'asc' }))[0]).toBe(
      'Alpha',
    );
    expect(titles(applySort(rows, properties, { propertyId: 'p_notes', direction: 'asc' }))).toEqual([
      'Alpha',
      'Gamma',
      'Beta',
      'Delta',
    ]);
  });

  it('sorts by the row title', () => {
    expect(titles(applySort(rows, properties, { propertyId: TITLE_KEY, direction: 'asc' }))).toEqual([
      'Alpha',
      'Beta',
      'Delta',
      'Gamma',
    ]);
  });

  it('sorts a checkbox with unticked first', () => {
    const sorted = applySort(rows, properties, { propertyId: 'p_flag', direction: 'asc' });
    expect(titles(sorted).slice(0, 2)).toEqual(['Gamma', 'Alpha']);
  });

  it('leaves rows untouched without a usable sort', () => {
    expect(applySort(rows, properties, null)).toBe(rows);
    expect(applySort(rows, properties, { propertyId: 'gone', direction: 'asc' })).toBe(rows);
  });
});

describe('applyView', () => {
  it('filters first, then sorts what is left', () => {
    const result = applyView(
      rows,
      properties,
      [filter('p_status', 'is_not', 'o_done')],
      { propertyId: TITLE_KEY, direction: 'desc' },
    );
    expect(titles(result)).toEqual(['Gamma', 'Delta', 'Alpha']);
  });
});

describe('groupRows', () => {
  it('makes one column per option plus a home for empties', () => {
    const columns = groupRows(rows, status);
    expect(columns.map((c) => c.name)).toEqual(['To do', 'Doing', 'Done', 'No value']);
    expect(columns.map((c) => titles(c.rows))).toEqual([['Alpha'], ['Gamma'], ['Beta'], ['Delta']]);
    expect(columns[0].color).toBe('amber');
  });

  it('falls back to a single column with no grouping property', () => {
    const columns = groupRows(rows, null);
    expect(columns).toHaveLength(1);
    expect(columns[0].rows).toHaveLength(4);
  });
});
