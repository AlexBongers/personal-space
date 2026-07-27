import { beforeEach, describe, expect, it } from 'vitest';
import { type DB, openDb } from '../db.js';
import { PROPERTY_TYPES } from '../types.js';
import { createDatabase, getDatabase } from './databases.js';
import { NotFound, createPage, getTree } from './pages.js';
import {
  createProperty,
  deleteProperty,
  listProperties,
  nextColor,
  updateProperty,
} from './properties.js';
import { coerce, createRow, deleteRow, getRow, listRows, updateRow } from './rows.js';
import { listViews, updateView } from './views.js';

let db: DB;
let databaseId: string;

beforeEach(() => {
  db = openDb(':memory:');
  databaseId = createDatabase(db, { title: 'Tasks', withStatus: false }).id;
});

describe('createDatabase', () => {
  it('creates a database page that appears in the tree', () => {
    const tree = getTree(db);
    expect(tree).toHaveLength(1);
    expect(tree[0].kind).toBe('database');
    expect(tree[0].title).toBe('Tasks');
  });

  it('creates exactly one view of each kind', () => {
    expect(listViews(db, databaseId).map((v) => v.kind)).toEqual(['table', 'board', 'list']);
  });

  it('gives a new database a starter Status select', () => {
    const fresh = createDatabase(db, { title: 'Fresh' });
    const properties = listProperties(db, fresh.id);
    expect(properties).toHaveLength(1);
    expect(properties[0].name).toBe('Status');
    expect(properties[0].options.map((o) => o.name)).toEqual(['To do', 'In progress', 'Done']);
  });

  it('rejects reading a database from an ordinary page', () => {
    const page = createPage(db, { title: 'Plain' });
    expect(() => getDatabase(db, page.id)).toThrow(/not a database/);
    expect(() => getDatabase(db, 'nope')).toThrow(NotFound);
  });
});

describe('properties', () => {
  it('supports all seven types', () => {
    for (const type of PROPERTY_TYPES) createProperty(db, databaseId, { name: type, type });
    expect(listProperties(db, databaseId).map((p) => p.type)).toEqual(PROPERTY_TYPES);
  });

  it('renames a property but keeps its type', () => {
    const property = createProperty(db, databaseId, { name: 'Due', type: 'date' });
    const renamed = updateProperty(db, property.id, { name: 'Deadline' });
    expect(renamed.name).toBe('Deadline');
    expect(renamed.type).toBe('date');
  });

  it('falls back to a default name', () => {
    expect(createProperty(db, databaseId, { name: '   ' }).name).toBe('Property');
  });

  it('rejects unknown types and non-database parents', () => {
    expect(() => createProperty(db, databaseId, { type: 'colour' })).toThrow(/unknown property type/);
    const page = createPage(db, { title: 'Plain' });
    expect(() => createProperty(db, page.id)).toThrow(/not a database/);
    expect(() => createProperty(db, 'nope')).toThrow(NotFound);
  });

  it('stores user-defined options with their colors', () => {
    const property = createProperty(db, databaseId, { name: 'Status', type: 'select' });
    const options = [
      { id: 'op_1', name: 'To do', color: nextColor(0) },
      { id: 'op_2', name: 'Doing', color: nextColor(1) },
    ];
    expect(updateProperty(db, property.id, { options }).options).toEqual(options);
    expect(listProperties(db, databaseId)[0].options).toHaveLength(2);
  });

  it('cycles option colors through the palette', () => {
    expect(nextColor(0)).toBe('amber');
    expect(nextColor(6)).toBe(nextColor(0));
    expect(new Set([0, 1, 2, 3, 4, 5].map(nextColor)).size).toBe(6);
  });

  it('deleting a property removes its values and view references', () => {
    const status = createProperty(db, databaseId, {
      name: 'Status',
      type: 'select',
      options: [{ id: 'op_done', name: 'Done', color: 'green' }],
    });
    const option = status.options[0];
    const row = createRow(db, databaseId, { title: 'Task', values: { [status.id]: option.id } });
    expect(getRow(db, row.id)!.values[status.id]).toBe(option.id);

    const [table, board] = listViews(db, databaseId);
    updateView(db, board.id, { groupPropertyId: status.id });
    updateView(db, table.id, {
      sort: { propertyId: status.id, direction: 'asc' },
      filters: [{ id: 'f1', propertyId: status.id, operator: 'is', value: option.id }],
    });

    deleteProperty(db, status.id);

    expect(listProperties(db, databaseId)).toHaveLength(0);
    expect(getRow(db, row.id)!.values).toEqual({});
    const views = listViews(db, databaseId);
    expect(views.find((v) => v.kind === 'board')!.groupPropertyId).toBeNull();
    expect(views.find((v) => v.kind === 'table')!.sort).toBeNull();
    expect(views.find((v) => v.kind === 'table')!.filters).toEqual([]);
  });

  it('rejects an unknown property', () => {
    expect(() => updateProperty(db, 'nope', { name: 'x' })).toThrow(NotFound);
    expect(() => deleteProperty(db, 'nope')).toThrow(NotFound);
  });
});

describe('rows', () => {
  it('adds rows that stay out of the sidebar tree', () => {
    createRow(db, databaseId, { title: 'First' });
    createRow(db, databaseId, { title: 'Second' });
    expect(listRows(db, databaseId).map((r) => r.title)).toEqual(['First', 'Second']);
    expect(getTree(db)[0].children).toEqual([]);
  });

  it('stores a value of every property type', () => {
    const make = (name: string, type: string) => createProperty(db, databaseId, { name, type }).id;
    const text = make('Text', 'text');
    const number = make('Number', 'number');
    const select = make('Select', 'select');
    const multi = make('Multi', 'multi_select');
    const date = make('Date', 'date');
    const check = make('Check', 'checkbox');
    const url = make('Url', 'url');

    const row = createRow(db, databaseId, {
      title: 'All types',
      values: {
        [text]: 'hello',
        [number]: '42',
        [select]: 'opt_a',
        [multi]: ['opt_a', 'opt_b'],
        [date]: '2026-08-01',
        [check]: true,
        [url]: 'https://example.com',
      },
    });

    expect(row.values).toEqual({
      [text]: 'hello',
      [number]: 42,
      [select]: 'opt_a',
      [multi]: ['opt_a', 'opt_b'],
      [date]: '2026-08-01',
      [check]: true,
      [url]: 'https://example.com',
    });
  });

  it('edits a title and single cells without touching the others', () => {
    const a = createProperty(db, databaseId, { name: 'A', type: 'text' }).id;
    const b = createProperty(db, databaseId, { name: 'B', type: 'text' }).id;
    const row = createRow(db, databaseId, { title: 'Row', values: { [a]: 'one', [b]: 'two' } });

    const updated = updateRow(db, row.id, { title: 'Renamed', values: { [a]: 'changed' } });
    expect(updated.title).toBe('Renamed');
    expect(updated.values[a]).toBe('changed');
    expect(updated.values[b]).toBe('two');
  });

  it('clears a cell when given an empty value', () => {
    const a = createProperty(db, databaseId, { name: 'A', type: 'text' }).id;
    const row = createRow(db, databaseId, { title: 'Row', values: { [a]: 'one' } });
    expect(updateRow(db, row.id, { values: { [a]: '' } }).values[a]).toBeNull();
  });

  it('ignores properties from another database', () => {
    const other = createDatabase(db, { title: 'Other', withStatus: false }).id;
    const stranger = createProperty(db, other, { name: 'Stranger', type: 'text' }).id;
    const row = createRow(db, databaseId, { title: 'Row', values: { [stranger]: 'nope' } });
    expect(row.values).toEqual({});
  });

  it('deletes a row and its values', () => {
    const a = createProperty(db, databaseId, { name: 'A', type: 'text' }).id;
    const row = createRow(db, databaseId, { title: 'Row', values: { [a]: 'one' } });
    deleteRow(db, row.id);
    expect(listRows(db, databaseId)).toEqual([]);
    expect(getRow(db, row.id)).toBeNull();
  });

  it('rejects rows on ordinary pages and unknown ids', () => {
    const page = createPage(db, { title: 'Plain' });
    expect(() => createRow(db, page.id)).toThrow(/not a database/);
    expect(() => createRow(db, 'nope')).toThrow(NotFound);
    expect(() => updateRow(db, 'nope', { title: 'x' })).toThrow(NotFound);
    expect(() => deleteRow(db, 'nope')).toThrow(NotFound);
    expect(getRow(db, page.id)).toBeNull();
  });
});

describe('coerce', () => {
  it('normalises each type', () => {
    expect(coerce('number', '12')).toBe(12);
    expect(coerce('number', 'abc')).toBeNull();
    expect(coerce('checkbox', 'true')).toBe(true);
    expect(coerce('checkbox', false)).toBe(false);
    expect(coerce('multi_select', 'one')).toEqual(['one']);
    expect(coerce('multi_select', ['a', 'b'])).toEqual(['a', 'b']);
    expect(coerce('text', 7)).toBe('7');
    expect(coerce('text', '')).toBeNull();
    expect(coerce('text', null)).toBeNull();
  });
});

describe('getDatabase', () => {
  it('returns the page, properties, rows and views together', () => {
    const status = createProperty(db, databaseId, { name: 'Status', type: 'select' }).id;
    createRow(db, databaseId, { title: 'One', values: { [status]: 'x' } });

    const detail = getDatabase(db, databaseId);
    expect(detail.page.title).toBe('Tasks');
    expect(detail.properties).toHaveLength(1);
    expect(detail.rows).toHaveLength(1);
    expect(detail.views.map((v) => v.kind)).toEqual(['table', 'board', 'list']);
  });
});
