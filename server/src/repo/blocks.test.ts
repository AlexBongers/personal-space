import { beforeEach, describe, expect, it } from 'vitest';
import { type DB, openDb } from '../db.js';
import { BLOCK_TYPES } from '../types.js';
import {
  createBlock,
  deleteBlock,
  getBlock,
  listBlocks,
  reorderBlocks,
  setBlocks,
  updateBlock,
} from './blocks.js';
import { NotFound, createPage, deletePage } from './pages.js';

let db: DB;
let pageId: string;

beforeEach(() => {
  db = openDb(':memory:');
  pageId = createPage(db, { title: 'Page' }).id;
});

describe('createBlock', () => {
  it('appends blocks in order', () => {
    const a = createBlock(db, pageId, { text: 'first' });
    const b = createBlock(db, pageId, { text: 'second' });
    expect([a.position, b.position]).toEqual([0, 1]);
    expect(listBlocks(db, pageId).map((x) => x.text)).toEqual(['first', 'second']);
  });

  it('defaults to an empty paragraph', () => {
    const block = createBlock(db, pageId);
    expect(block.type).toBe('paragraph');
    expect(block.text).toBe('');
    expect(block.checked).toBe(false);
  });

  it('accepts every block type', () => {
    for (const type of BLOCK_TYPES) {
      expect(createBlock(db, pageId, { type }).type).toBe(type);
    }
    expect(listBlocks(db, pageId)).toHaveLength(BLOCK_TYPES.length);
  });

  it('inserts directly below another block', () => {
    const a = createBlock(db, pageId, { text: 'a' });
    const c = createBlock(db, pageId, { text: 'c' });
    const b = createBlock(db, pageId, { text: 'b', afterId: a.id });
    expect(listBlocks(db, pageId).map((x) => x.text)).toEqual(['a', 'b', 'c']);
    expect(b.position).toBe(1);
    expect(getBlock(db, c.id)!.position).toBe(2);
  });

  it('rejects an unknown page or block type', () => {
    expect(() => createBlock(db, 'nope')).toThrow(NotFound);
    expect(() => createBlock(db, pageId, { type: 'banner' })).toThrow(/unknown block type/);
  });
});

describe('updateBlock', () => {
  it('edits text, type and checked state', () => {
    const block = createBlock(db, pageId, { text: 'draft' });
    expect(updateBlock(db, block.id, { text: 'final' }).text).toBe('final');
    expect(updateBlock(db, block.id, { type: 'heading2' }).type).toBe('heading2');
    expect(updateBlock(db, block.id, { checked: true }).checked).toBe(true);
    expect(updateBlock(db, block.id, { checked: false }).checked).toBe(false);
  });

  it('rejects an unknown block or type', () => {
    const block = createBlock(db, pageId);
    expect(() => updateBlock(db, 'nope', { text: 'x' })).toThrow(NotFound);
    expect(() => updateBlock(db, block.id, { type: 'nope' })).toThrow(/unknown block type/);
  });
});

describe('deleteBlock', () => {
  it('removes one block and leaves the rest', () => {
    const a = createBlock(db, pageId, { text: 'a' });
    const b = createBlock(db, pageId, { text: 'b' });
    deleteBlock(db, a.id);
    expect(listBlocks(db, pageId).map((x) => x.id)).toEqual([b.id]);
    expect(getBlock(db, a.id)).toBeNull();
  });

  it('rejects an unknown block', () => {
    expect(() => deleteBlock(db, 'nope')).toThrow(NotFound);
  });

  it('cascades when the page is deleted', () => {
    createBlock(db, pageId, { text: 'a' });
    deletePage(db, pageId);
    expect(listBlocks(db, pageId)).toEqual([]);
  });
});

describe('reorderBlocks', () => {
  it('rewrites positions to match the given order', () => {
    const a = createBlock(db, pageId, { text: 'a' });
    const b = createBlock(db, pageId, { text: 'b' });
    const c = createBlock(db, pageId, { text: 'c' });
    const result = reorderBlocks(db, pageId, [c.id, a.id, b.id]);
    expect(result.map((x) => x.text)).toEqual(['c', 'a', 'b']);
    expect(listBlocks(db, pageId).map((x) => x.text)).toEqual(['c', 'a', 'b']);
  });

  it('ignores ids from another page', () => {
    const other = createPage(db, { title: 'Other' }).id;
    const mine = createBlock(db, pageId, { text: 'mine' });
    const theirs = createBlock(db, other, { text: 'theirs' });
    reorderBlocks(db, pageId, [theirs.id, mine.id]);
    expect(getBlock(db, theirs.id)!.position).toBe(0);
    expect(listBlocks(db, pageId).map((x) => x.text)).toEqual(['mine']);
  });
});

describe('setBlocks', () => {
  it('replaces the page contents', () => {
    createBlock(db, pageId, { text: 'old' });
    setBlocks(db, pageId, [{ type: 'heading1', text: 'new' }, { type: 'todo', text: 'go', checked: true }]);
    const blocks = listBlocks(db, pageId);
    expect(blocks.map((b) => b.text)).toEqual(['new', 'go']);
    expect(blocks[1].checked).toBe(true);
  });
});

describe('text coercion', () => {
  it('stores non-string block text as text', () => {
    const block = createBlock(db, pageId, { text: 5 as unknown as string });
    expect(block.text).toBe('5');
    expect(updateBlock(db, block.id, { text: 9 as unknown as string }).text).toBe('9');
  });
});
