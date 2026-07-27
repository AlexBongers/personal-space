import { describe, expect, it } from 'vitest';
import { displayTitle, displayValue, formatDate, isEmptyValue, optionsFor, selectedIds } from './db.ts';
import { property } from './test/factories.ts';

const status = property('Status', 'select', {
  options: [
    { id: 'o1', name: 'To do', color: 'amber' },
    { id: 'o2', name: 'Done', color: 'green' },
  ],
});
const tags = property('Tags', 'multi_select', { options: status.options });

describe('selectedIds', () => {
  it('normalises single and multi values', () => {
    expect(selectedIds('o1')).toEqual(['o1']);
    expect(selectedIds(['o1', 'o2'])).toEqual(['o1', 'o2']);
    expect(selectedIds(null)).toEqual([]);
    expect(selectedIds('')).toEqual([]);
  });
});

describe('optionsFor', () => {
  it('resolves ids to options and drops unknown ones', () => {
    expect(optionsFor(status, 'o2').map((o) => o.name)).toEqual(['Done']);
    expect(optionsFor(tags, ['o1', 'gone', 'o2']).map((o) => o.name)).toEqual(['To do', 'Done']);
  });
});

describe('displayValue', () => {
  it('renders each property type for reading', () => {
    expect(displayValue(property('Name', 'text'), 'Hello')).toBe('Hello');
    expect(displayValue(property('N', 'number'), 4)).toBe('4');
    expect(displayValue(property('Ok', 'checkbox'), true)).toBe('Yes');
    expect(displayValue(property('Ok', 'checkbox'), false)).toBe('No');
    expect(displayValue(status, 'o1')).toBe('To do');
    expect(displayValue(tags, ['o1', 'o2'])).toBe('To do, Done');
    expect(displayValue(property('D', 'date'), '2026-08-01')).toContain('2026');
  });

  it('renders empty values as an empty string', () => {
    expect(displayValue(property('Name', 'text'), null)).toBe('');
    expect(displayValue(property('Name', 'text'), '')).toBe('');
  });
});

describe('formatDate', () => {
  it('formats an ISO date and leaves junk alone', () => {
    expect(formatDate('2026-08-01')).toMatch(/2026/);
    expect(formatDate('not-a-date')).toBe('not-a-date');
  });
});

describe('isEmptyValue', () => {
  it('treats null, empty string and empty array as empty', () => {
    expect(isEmptyValue(null)).toBe(true);
    expect(isEmptyValue('')).toBe(true);
    expect(isEmptyValue([])).toBe(true);
    expect(isEmptyValue(0)).toBe(false);
    expect(isEmptyValue(false)).toBe(false);
    expect(isEmptyValue(['a'])).toBe(false);
  });
});

describe('displayTitle', () => {
  it('falls back to Untitled when a title is emptied', () => {
    expect(displayTitle('')).toBe('Untitled');
    expect(displayTitle('   ')).toBe('Untitled');
    expect(displayTitle('Notes')).toBe('Notes');
    expect(displayTitle('  Notes  ')).toBe('Notes');
  });
});
