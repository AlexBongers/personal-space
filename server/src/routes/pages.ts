import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../db";

interface PageRow {
  id: string;
  title: string;
  parent_id: string | null;
  icon: string | null;
  created_at: string;
  updated_at: string;
}

function rowToPage(row: PageRow) {
  return {
    id: row.id,
    title: row.title,
    parentId: row.parent_id ?? null,
    icon: row.icon ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const router = Router();

router.get("/", (_req: Request, res: Response) => {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM pages ORDER BY created_at ASC").all() as PageRow[];
  res.json(rows.map(rowToPage));
});

router.get("/:id", (req: Request<{ id: string }>, res: Response) => {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM pages WHERE id = ?")
    .get(req.params.id) as PageRow | undefined;

  if (!row) {
    res.status(404).json({ error: "Page not found" });
    return;
  }

  res.json(rowToPage(row));
});

router.post("/", (req: Request, res: Response) => {
  const db = getDb();
  const { title, parentId, icon } = req.body;

  if (!title || typeof title !== "string" || title.trim().length === 0) {
    res.status(400).json({ error: "Title is required" });
    return;
  }

  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(
    "INSERT INTO pages (id, title, parent_id, icon, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(id, title.trim(), parentId ?? null, icon ?? null, now, now);

  const row = db.prepare("SELECT * FROM pages WHERE id = ?").get(id) as PageRow;
  res.status(201).json(rowToPage(row));
});

router.patch("/:id", (req: Request<{ id: string }>, res: Response) => {
  const db = getDb();
  const { id } = req.params;
  const { title, icon, parentId } = req.body;

  const existing = db.prepare("SELECT * FROM pages WHERE id = ?").get(id) as PageRow | undefined;
  if (!existing) {
    res.status(404).json({ error: "Page not found" });
    return;
  }

  const newTitle = title !== undefined ? String(title).trim() : existing.title;
  const newIcon = icon !== undefined ? icon : existing.icon;
  const newParentId = parentId !== undefined ? parentId : existing.parent_id;

  if (newTitle.length === 0) {
    res.status(400).json({ error: "Title cannot be empty" });
    return;
  }

  const now = new Date().toISOString();

  db.prepare(
    "UPDATE pages SET title = ?, icon = ?, parent_id = ?, updated_at = ? WHERE id = ?"
  ).run(newTitle, newIcon, newParentId, now, id);

  const row = db.prepare("SELECT * FROM pages WHERE id = ?").get(id) as PageRow;
  res.json(rowToPage(row));
});

router.delete("/:id", (req: Request<{ id: string }>, res: Response) => {
  const db = getDb();
  const { id } = req.params;

  const existing = db.prepare("SELECT * FROM pages WHERE id = ?").get(id) as PageRow | undefined;
  if (!existing) {
    res.status(404).json({ error: "Page not found" });
    return;
  }

  function deleteChildren(parentId: string): void {
    const children = db.prepare("SELECT id FROM pages WHERE parent_id = ?").all(parentId) as { id: string }[];
    for (const child of children) {
      deleteChildren(child.id);
      db.prepare("DELETE FROM pages WHERE id = ?").run(child.id);
    }
  }

  deleteChildren(id);
  db.prepare("DELETE FROM pages WHERE id = ?").run(id);

  res.json({ success: true });
});

export default router;