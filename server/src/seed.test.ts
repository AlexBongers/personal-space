import { beforeEach, describe, expect, it } from 'vitest';
import { type DB, openDb } from './db.js';
import { listBlocks } from './repo/blocks.js';
import { createPage, getTree } from './repo/pages.js';
import { listProperties } from './repo/properties.js';
import { listRows } from './repo/rows.js';
import { listViews } from './repo/views.js';
import { isEmpty, seed, seedIfEmpty } from './seed.js';
import { BLOCK_TYPES, PROPERTY_TYPES } from './types.js';

let db: DB;

beforeEach(() => {
  db = openDb(':memory:');
});

function allPages(db: DB) {
  return db.prepare('SELECT id, title, kind FROM pages').all() as {
    id: string;
    title: string;
    kind: string;
  }[];
}

describe('seed', () => {
  it('reports an empty database', () => {
    expect(isEmpty(db)).toBe(true);
    seed(db);
    expect(isEmpty(db)).toBe(false);
  });

  it('builds a nested tree with icons', () => {
    seed(db);
    const tree = getTree(db);
    expect(tree.map((p) => p.title)).toEqual(['Home', 'Projects', 'Notes', 'Life']);
    expect(tree.every((p) => p.icon)).toBe(true);

    const projects = tree.find((p) => p.title === 'Projects')!;
    const personalSpace = projects.children.find((p) => p.title === 'Personal Space')!;
    expect(personalSpace.children.map((p) => p.title)).toEqual(['Design Notes', 'Technical Spikes']);
  });

  it('uses every block type somewhere in the workspace', () => {
    seed(db);
    const used = new Set(allPages(db).flatMap((page) => listBlocks(db, page.id)).map((b) => b.type));
    for (const type of BLOCK_TYPES) expect(used).toContain(type);
  });

  it('shows off every property type across its databases', () => {
    seed(db);
    const databases = allPages(db).filter((page) => page.kind === 'database');
    expect(databases.length).toBeGreaterThanOrEqual(2);

    const used = new Set(databases.flatMap((page) => listProperties(db, page.id)).map((p) => p.type));
    for (const type of PROPERTY_TYPES) expect(used).toContain(type);
  });

  it('gives every database rows and all three views', () => {
    seed(db);
    for (const page of allPages(db).filter((p) => p.kind === 'database')) {
      expect(listRows(db, page.id).length).toBeGreaterThan(4);
      expect(listViews(db, page.id).map((v) => v.kind)).toEqual(['table', 'board', 'list']);
    }
  });

  it('ships a filtered view, a sorted view and a grouped board', () => {
    seed(db);
    const views = allPages(db)
      .filter((page) => page.kind === 'database')
      .flatMap((page) => listViews(db, page.id));

    expect(views.some((view) => view.filters.length > 0)).toBe(true);
    expect(views.some((view) => view.sort !== null)).toBe(true);
    expect(views.filter((view) => view.kind === 'board').every((view) => view.groupPropertyId)).toBe(
      true,
    );
  });

  it('gives select options user-visible names and colors', () => {
    seed(db);
    const options = allPages(db)
      .filter((page) => page.kind === 'database')
      .flatMap((page) => listProperties(db, page.id))
      .flatMap((property) => property.options);

    expect(options.length).toBeGreaterThan(8);
    expect(options.every((option) => option.name && option.color)).toBe(true);
  });

  it('seeds only when the database is empty', () => {
    createPage(db, { title: 'Mine' });
    seedIfEmpty(db);
    expect(getTree(db).map((p) => p.title)).toEqual(['Mine']);
  });
});
