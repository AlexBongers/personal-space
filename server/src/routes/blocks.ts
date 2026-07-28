import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../db";

type BlockType =
  | "paragraph"
  | "heading1"
  | "heading2"
  | "heading3"
  | "bulleted_list"
  | "numbered_list"
  | "todo"
  | "quote"
  | "divider"
  | "code"
  | "callout";

interface BlockDto {
  id: string;
  pageId: string;
  type: BlockType;
  content: string;
  position: number;
  checked: boolean;
  createdAt: string;
  updatedAt: string;
}

interface BlockRow {
  id: string;
  page_id: string;
  type: string;
  content: string;
  position: number;
  checked: number;
  created_at: string;
  updated_at: string;
}

function rowToBlock(row: BlockRow): BlockDto {
  return {
    id: row.id,
    pageId: row.page_id,
    type: row.type as BlockType,
    content: row.content,
    position: row.position,
    checked: row.checked === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const VALID_BLOCK_TYPES = [
  "paragraph",
  "heading1",
  "heading2",
  "heading3",
  "bulleted_list",
  "numbered_list",
  "todo",
  "quote",
  "divider",
  "code",
  "callout",
];

const router = Router();

router.get("/api/pages/:pageId/blocks", (req: Request<{ pageId: string }>, res: Response) => {
  const db = getDb();
  const { pageId } = req.params;

  const page = db.prepare("SELECT id FROM pages WHERE id = ?").get(pageId);
  if (!page) {
    res.status(404).json({ error: "Page not found" });
    return;
  }

  const rows = db
    .prepare("SELECT * FROM blocks WHERE page_id = ? ORDER BY position ASC")
    .all(pageId) as BlockRow[];

  res.json(rows.map(rowToBlock));
});

router.post("/api/pages/:pageId/blocks", (req: Request<{ pageId: string }>, res: Response) => {
  const db = getDb();
  const { pageId } = req.params;
  const { type, content, position } = req.body;

  if (!type || !VALID_BLOCK_TYPES.includes(type)) {
    res.status(400).json({ error: "Invalid block type" });
    return;
  }

  const page = db.prepare("SELECT id FROM pages WHERE id = ?").get(pageId);
  if (!page) {
    res.status(404).json({ error: "Page not found" });
    return;
  }

  const id = uuidv4();
  const now = new Date().toISOString();
  const blockContent = content ?? "";

  let blockPosition: number;
  if (position !== undefined) {
    blockPosition = position;
  } else {
    const maxRow = db
      .prepare("SELECT COALESCE(MAX(position), -1) AS max_pos FROM blocks WHERE page_id = ?")
      .get(pageId) as { max_pos: number };
    blockPosition = maxRow.max_pos + 1;
  }

  db.prepare(
    "INSERT INTO blocks (id, page_id, type, content, position, checked, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?)"
  ).run(id, pageId, type, String(blockContent), blockPosition, now, now);

  const row = db.prepare("SELECT * FROM blocks WHERE id = ?").get(id) as BlockRow;
  res.status(201).json(rowToBlock(row));
});

router.patch("/api/blocks/reorder", (req: Request, res: Response) => {
  const db = getDb();
  const { blocks } = req.body as { blocks?: { id: string; position: number }[] };

  if (!blocks || !Array.isArray(blocks)) {
    res.status(400).json({ error: "blocks array is required" });
    return;
  }

  const reorder = db.transaction(() => {
    const now = new Date().toISOString();
    const stmt = db.prepare(
      "UPDATE blocks SET position = ?, updated_at = ? WHERE id = ?"
    );

    for (const block of blocks) {
      stmt.run(block.position, now, block.id);
    }
  });

  reorder();

  res.json({ success: true });
});

router.patch("/api/blocks/:id", (req: Request<{ id: string }>, res: Response) => {
  const db = getDb();
  const { id } = req.params;
  const { content, type, checked, position } = req.body;

  const existing = db
    .prepare("SELECT * FROM blocks WHERE id = ?")
    .get(id) as BlockRow | undefined;

  if (!existing) {
    res.status(404).json({ error: "Block not found" });
    return;
  }

  if (type !== undefined && !VALID_BLOCK_TYPES.includes(type)) {
    res.status(400).json({ error: "Invalid block type" });
    return;
  }

  const newType = type !== undefined ? type : existing.type;
  const newContent = content !== undefined ? String(content) : existing.content;
  const newChecked =
    checked !== undefined ? (checked ? 1 : 0) : existing.checked;
  const newPosition =
    position !== undefined ? position : existing.position;
  const now = new Date().toISOString();

  db.prepare(
    "UPDATE blocks SET type = ?, content = ?, checked = ?, position = ?, updated_at = ? WHERE id = ?"
  ).run(newType, newContent, newChecked, newPosition, now, id);

  const row = db.prepare("SELECT * FROM blocks WHERE id = ?").get(id) as BlockRow;
  res.json(rowToBlock(row));
});

router.delete("/api/blocks/:id", (req: Request<{ id: string }>, res: Response) => {
  const db = getDb();
  const { id } = req.params;

  const existing = db
    .prepare("SELECT * FROM blocks WHERE id = ?")
    .get(id) as BlockRow | undefined;

  if (!existing) {
    res.status(404).json({ error: "Block not found" });
    return;
  }

  db.prepare("DELETE FROM blocks WHERE id = ?").run(id);
  res.json({ success: true });
});

export default router;
