import { beforeEach, describe, expect, it } from 'vitest';
import { type DB, openDb } from '../db.js';
import { createDatabase } from './databases.js';
import { createPage } from './pages.js';
import { createRow } from './rows.js';
import { escapeLike, search } from './search.js';

let db: DB;

beforeEach(() => {
  db = openDb(':memory:');
  const notes = createPage(db, { title: 'Notes', icon: '📓' });
  createPage(db, { parentId: notes.id, title: 'Meeting Notes', icon: '💬' });
  createPage(db, { parentId: notes.id, title: 'Ideas', icon: '💡' });
  const tasks = createDatabase(db, { title: 'Tasks', icon: '✅', withStatus: false });
  createRow(db, tasks.id, { title: 'Note the deadline' });
  createRow(db, tasks.id, { title: 'Buy milk' });
});

const titles = (query: string) => search(db, query).map((r) => r.title);

describe('search', () => {
  it('returns nothing for an empty query', () => {
    expect(search(db, '')).toEqual([]);
    expect(search(db, '   ')).toEqual([]);
  });

  it('matches pages, databases and rows alike', () => {
    expect(titles('note')).toEqual(['Note the deadline', 'Notes', 'Meeting Notes']);
    expect(titles('tasks')).toEqual(['Tasks']);
    expect(titles('milk')).toEqual(['Buy milk']);
  });

  it('ignores case and matches anywhere in the title', () => {
    expect(titles('IDEAS')).toEqual(['Ideas']);
    expect(titles('eeting')).toEqual(['Meeting Notes']);
  });

  it('puts prefix matches first', () => {
    expect(titles('note')[0]).toBe('Note the deadline');
  });

  it('carries the icon, kind and parent title', () => {
    const [result] = search(db, 'Meeting');
    expect(result).toMatchObject({ title: 'Meeting Notes', icon: '💬', kind: 'page', parentTitle: 'Notes' });

    const [tasks] = search(db, 'Tasks');
    expect(tasks.kind).toBe('database');
    expect(tasks.parentTitle).toBeNull();

    const [row] = search(db, 'Buy milk');
    expect(row.kind).toBe('row');
    expect(row.parentTitle).toBe('Tasks');
  });

  it('returns nothing when nothing matches', () => {
    expect(search(db, 'zzzz')).toEqual([]);
  });

  it('treats LIKE wildcards as literal characters', () => {
    createPage(db, { title: '100% cotton' });
    expect(titles('%')).toEqual(['100% cotton']);
    expect(titles('_')).toEqual([]);
    expect(escapeLike('a%b_c\\d')).toBe('a\\%b\\_c\\\\d');
  });

  it('caps how many results come back', () => {
    for (let i = 0; i < 30; i++) createPage(db, { title: `Bulk ${i}` });
    expect(search(db, 'Bulk')).toHaveLength(20);
  });
});
