import type { DB } from '../db.js';
import { newId } from '../ids.js';
import { BLOCK_TYPES, type Block, type BlockType } from '../types.js';
import { NotFound, asText, getPage } from './pages.js';

interface BlockRow {
  id: string;
  page_id: string;
  type: string;
  text: string;
  checked: number;
  position: number;
}

function toBlock(row: BlockRow): Block {
  return {
    id: row.id,
    pageId: row.page_id,
    type: row.type as BlockType,
    text: row.text,
    checked: row.checked === 1,
    position: row.position,
  };
}

function assertBlockType(type: string): BlockType {
  if (!BLOCK_TYPES.includes(type as BlockType)) throw new Error(`unknown block type: ${type}`);
  return type as BlockType;
}

export function listBlocks(db: DB, pageId: string): Block[] {
  const rows = db
    .prepare('SELECT * FROM blocks WHERE page_id = ? ORDER BY position')
    .all(pageId) as BlockRow[];
  return rows.map(toBlock);
}

export function getBlock(db: DB, id: string): Block | null {
  const row = db.prepare('SELECT * FROM blocks WHERE id = ?').get(id) as BlockRow | undefined;
  return row ? toBlock(row) : null;
}

export interface CreateBlockInput {
  type?: string;
  text?: string;
  checked?: boolean;
  /** Insert directly below this block; appended to the end when omitted. */
  afterId?: string | null;
  /** The client may pick the id so it can render the block before the round trip. */
  id?: string;
}

export function createBlock(db: DB, pageId: string, input: CreateBlockInput = {}): Block {
  if (!getPage(db, pageId)) throw new NotFound('page not found');
  const type = assertBlockType(input.type ?? 'paragraph');

  const after = input.afterId ? getBlock(db, input.afterId) : null;
  let position: number;
  if (after && after.pageId === pageId) {
    position = after.position + 1;
    db.prepare('UPDATE blocks SET position = position + 1 WHERE page_id = ? AND position > ?').run(
      pageId,
      after.position,
    );
  } else {
    const max = db
      .prepare('SELECT COALESCE(MAX(position), -1) AS m FROM blocks WHERE page_id = ?')
      .get(pageId) as { m: number };
    position = max.m + 1;
  }

  const block: Block = {
    id: input.id ?? newId('bl'),
    pageId,
    type,
    text: input.text === undefined ? '' : asText(input.text),
    checked: input.checked ?? false,
    position,
  };
  db.prepare(
    'INSERT INTO blocks (id, page_id, type, text, checked, position) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(block.id, block.pageId, block.type, block.text, block.checked ? 1 : 0, block.position);
  return block;
}

export interface UpdateBlockInput {
  type?: string;
  text?: string;
  checked?: boolean;
}

export function updateBlock(db: DB, id: string, input: UpdateBlockInput): Block {
  const block = getBlock(db, id);
  if (!block) throw new NotFound('block not found');

  if (input.type !== undefined) {
    db.prepare('UPDATE blocks SET type = ? WHERE id = ?').run(assertBlockType(input.type), id);
  }
  if (input.text !== undefined) {
    db.prepare('UPDATE blocks SET text = ? WHERE id = ?').run(asText(input.text), id);
  }
  if (input.checked !== undefined) {
    db.prepare('UPDATE blocks SET checked = ? WHERE id = ?').run(input.checked ? 1 : 0, id);
  }
  return getBlock(db, id)!;
}

export function deleteBlock(db: DB, id: string): void {
  const block = getBlock(db, id);
  if (!block) throw new NotFound('block not found');
  db.prepare('DELETE FROM blocks WHERE id = ?').run(id);
}

/** Rewrites the page's block order to match the given id list. */
export function reorderBlocks(db: DB, pageId: string, orderedIds: string[]): Block[] {
  const update = db.prepare('UPDATE blocks SET position = ? WHERE id = ? AND page_id = ?');
  db.transaction(() => {
    orderedIds.forEach((id, index) => update.run(index, id, pageId));
  })();
  return listBlocks(db, pageId);
}

/** Replaces a page's blocks wholesale — used by the seed. */
export function setBlocks(db: DB, pageId: string, blocks: CreateBlockInput[]): void {
  db.transaction(() => {
    db.prepare('DELETE FROM blocks WHERE page_id = ?').run(pageId);
    for (const block of blocks) createBlock(db, pageId, block);
  })();
}
