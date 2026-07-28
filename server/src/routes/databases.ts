import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../db";
import { getRowsWithFilterSort } from "./views";

interface DbRow {
  id: string;
  page_id: string | null;
  name: string;
  properties: string;
  created_at: string;
  updated_at: string;
}

interface RowRow {
  id: string;
  database_id: string;
  page_id: string | null;
  title: string;
  data: string;
  created_at: string;
  updated_at: string;
}

interface SelectOptionRow {
  id: string;
  database_id: string;
  property_id: string;
  value: string;
  color: string;
  position: number;
}

const PROPERTY_TYPES = ["text", "number", "select", "multi-select", "date", "checkbox", "url"] as const;

function createDefaultViews(databaseId: string) {
  const db = getDb();
  const now = new Date().toISOString();

  const tableViewId = uuidv4();
  db.prepare(
    "INSERT INTO views (id, database_id, type, name, filters, sort_field, sort_direction, group_field, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(tableViewId, databaseId, "table", "Table View", "[]", null, "asc", null, now, now);

  const boardViewId = uuidv4();
  db.prepare(
    "INSERT INTO views (id, database_id, type, name, filters, sort_field, sort_direction, group_field, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(boardViewId, databaseId, "board", "Board View", "[]", null, "asc", null, now, now);

  const listViewId = uuidv4();
  db.prepare(
    "INSERT INTO views (id, database_id, type, name, filters, sort_field, sort_direction, group_field, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(listViewId, databaseId, "list", "List View", "[]", null, "asc", null, now, now);
}

function dbRowToDatabase(row: DbRow) {
  return {
    id: row.id,
    pageId: row.page_id,
    name: row.name,
    properties: JSON.parse(row.properties || "[]"),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function populateOptions(database: ReturnType<typeof dbRowToDatabase>) {
  const db = getDb();
  for (const prop of database.properties) {
    if (prop.type === "select" || prop.type === "multi-select") {
      const options = db
        .prepare("SELECT * FROM select_options WHERE database_id = ? AND property_id = ? ORDER BY position ASC")
        .all(database.id, prop.id) as SelectOptionRow[];
      prop.options = options.map((o) => ({
        id: o.id,
        value: o.value,
        color: o.color,
      }));
    }
  }
  return database;
}

function dbRowToRow(row: RowRow) {
  return {
    id: row.id,
    databaseId: row.database_id,
    pageId: row.page_id,
    title: row.title,
    data: JSON.parse(row.data || "{}"),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function dbRowToSelectOption(row: SelectOptionRow) {
  return {
    id: row.id,
    value: row.value,
    color: row.color,
  };
}

const router = Router();

router.post("/", (req: Request, res: Response) => {
  const db = getDb();
  const { pageId, name, properties } = req.body;

  if (!pageId || typeof pageId !== "string") {
    res.status(400).json({ error: "pageId is required" });
    return;
  }

  const existing = db.prepare("SELECT * FROM pages WHERE id = ?").get(pageId);
  if (!existing) {
    res.status(400).json({ error: "Page not found" });
    return;
  }

  const existingDb = db.prepare("SELECT * FROM databases WHERE page_id = ?").get(pageId);
  if (existingDb) {
    res.status(400).json({ error: "This page is already a database" });
    return;
  }

  const id = uuidv4();
  const now = new Date().toISOString();
  const dbName = name || "Untitled Database";
  const props = Array.isArray(properties) ? properties : [];

  for (const p of props) {
    if (!p.name || String(p.name).trim().length === 0) {
      res.status(400).json({ error: "Property name cannot be empty" });
      return;
    }
  }

  const validatedProps = props.map((p: Record<string, unknown>) => ({
    id: (p.id as string) || uuidv4(),
    name: String(p.name || ""),
    type: PROPERTY_TYPES.includes(p.type as typeof PROPERTY_TYPES[number]) ? p.type : "text",
    options: Array.isArray((p as { options?: unknown[] }).options) ? (p as { options?: unknown[] }).options : [],
  }));

  db.prepare(
    "INSERT INTO databases (id, page_id, name, properties, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(id, pageId, dbName, JSON.stringify(validatedProps), now, now);

  createDefaultViews(id);

  const row = db.prepare("SELECT * FROM databases WHERE id = ?").get(id) as DbRow;
  res.status(201).json(populateOptions(dbRowToDatabase(row)));
});

router.get("/by-page/:pageId", (req: Request<{ pageId: string }>, res: Response) => {
  const db = getDb();
  const row = db.prepare("SELECT * FROM databases WHERE page_id = ?").get(req.params.pageId) as DbRow | undefined;
  if (!row) {
    res.status(404).json({ error: "Database not found" });
    return;
  }
  res.json(populateOptions(dbRowToDatabase(row)));
});

router.get("/:id", (req: Request<{ id: string }>, res: Response) => {
  const db = getDb();
  const row = db.prepare("SELECT * FROM databases WHERE id = ?").get(req.params.id) as DbRow | undefined;
  if (!row) {
    res.status(404).json({ error: "Database not found" });
    return;
  }
  res.json(populateOptions(dbRowToDatabase(row)));
});

router.patch("/:id", (req: Request<{ id: string }>, res: Response) => {
  const db = getDb();
  const { id } = req.params;
  const { name, properties } = req.body;

  const existing = db.prepare("SELECT * FROM databases WHERE id = ?").get(id) as DbRow | undefined;
  if (!existing) {
    res.status(404).json({ error: "Database not found" });
    return;
  }

  const now = new Date().toISOString();
  const newName = name !== undefined ? String(name) : existing.name;
  const newProps = properties !== undefined ? JSON.stringify(properties) : existing.properties;

  db.prepare("UPDATE databases SET name = ?, properties = ?, updated_at = ? WHERE id = ?")
    .run(newName, newProps, now, id);

  const row = db.prepare("SELECT * FROM databases WHERE id = ?").get(id) as DbRow;
  res.json(populateOptions(dbRowToDatabase(row)));
});

router.get("/:id/rows", (req: Request<{ id: string }>, res: Response) => {
  const db = getDb();
  const databaseId = req.params.id;

  const existingDb = db.prepare("SELECT * FROM databases WHERE id = ?").get(databaseId);
  if (!existingDb) {
    res.status(404).json({ error: "Database not found" });
    return;
  }

  const sortField = req.query.sortField as string | undefined;
  const sortDir = req.query.sortDir as string | undefined;
  const filterJson = req.query.filter as string | undefined;

  if (sortField || filterJson) {
    const rows = getRowsWithFilterSort(databaseId, sortField, sortDir, filterJson);
    res.json(rows.map((row) => ({
      id: row.id,
      databaseId: row.database_id,
      pageId: row.page_id,
      title: row.title,
      data: JSON.parse(row.data || "{}"),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })));
    return;
  }

  const rows = db.prepare("SELECT * FROM rows WHERE database_id = ? ORDER BY created_at ASC").all(req.params.id) as RowRow[];
  res.json(rows.map(dbRowToRow));
});

router.post("/:id/rows", (req: Request<{ id: string }>, res: Response) => {
  const db = getDb();
  const { id: databaseId } = req.params;
  const { title, data } = req.body;

  const existingDb = db.prepare("SELECT * FROM databases WHERE id = ?").get(databaseId) as DbRow | undefined;
  if (!existingDb) {
    res.status(404).json({ error: "Database not found" });
    return;
  }

  const rowId = uuidv4();
  const pageId = uuidv4();
  const now = new Date().toISOString();
  const rowTitle = title || "";
  const rowData = data ? JSON.stringify(data) : "{}";

  db.prepare(
    "INSERT INTO pages (id, title, parent_id, icon, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(pageId, rowTitle || "Untitled", existingDb.page_id, null, now, now);

  db.prepare(
    "INSERT INTO rows (id, database_id, page_id, title, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(rowId, databaseId, pageId, rowTitle, rowData, now, now);

  const row = db.prepare("SELECT * FROM rows WHERE id = ?").get(rowId) as RowRow;
  res.status(201).json(dbRowToRow(row));
});

router.patch("/rows/:id", (req: Request<{ id: string }>, res: Response) => {
  const db = getDb();
  const { id } = req.params;
  const { title, data } = req.body;

  const existing = db.prepare("SELECT * FROM rows WHERE id = ?").get(id) as RowRow | undefined;
  if (!existing) {
    res.status(404).json({ error: "Row not found" });
    return;
  }

  const now = new Date().toISOString();
  const newTitle = title !== undefined ? String(title) : existing.title;
  const newData = data !== undefined ? JSON.stringify(data) : existing.data;

  db.prepare("UPDATE rows SET title = ?, data = ?, updated_at = ? WHERE id = ?")
    .run(newTitle, newData, now, id);

  if (title !== undefined && existing.page_id) {
    db.prepare("UPDATE pages SET title = ?, updated_at = ? WHERE id = ?")
      .run(newTitle, now, existing.page_id);
  }

  const row = db.prepare("SELECT * FROM rows WHERE id = ?").get(id) as RowRow;
  res.json(dbRowToRow(row));
});

router.delete("/rows/:id", (req: Request<{ id: string }>, res: Response) => {
  const db = getDb();
  const { id } = req.params;

  const existing = db.prepare("SELECT * FROM rows WHERE id = ?").get(id) as RowRow | undefined;
  if (!existing) {
    res.status(404).json({ error: "Row not found" });
    return;
  }

  if (existing.page_id) {
    db.prepare("DELETE FROM pages WHERE id = ?").run(existing.page_id);
  }

  db.prepare("DELETE FROM rows WHERE id = ?").run(id);
  res.json({ success: true });
});

router.patch("/:id/properties", (req: Request<{ id: string }>, res: Response) => {
  const db = getDb();
  const { id } = req.params;
  const { properties } = req.body;

  const existing = db.prepare("SELECT * FROM databases WHERE id = ?").get(id) as DbRow | undefined;
  if (!existing) {
    res.status(404).json({ error: "Database not found" });
    return;
  }

  if (!Array.isArray(properties)) {
    res.status(400).json({ error: "properties must be an array" });
    return;
  }

  for (const p of properties) {
    if (!p.name || String(p.name).trim().length === 0) {
      res.status(400).json({ error: "Property name cannot be empty" });
      return;
    }
  }

  const validatedProps = properties.map((p: Record<string, unknown>) => ({
    id: (p.id as string) || uuidv4(),
    name: String(p.name || ""),
    type: PROPERTY_TYPES.includes(p.type as typeof PROPERTY_TYPES[number]) ? p.type : "text",
    options: Array.isArray((p as { options?: unknown[] }).options) ? (p as { options?: unknown[] }).options : [],
  }));

  const now = new Date().toISOString();
  db.prepare("UPDATE databases SET properties = ?, updated_at = ? WHERE id = ?")
    .run(JSON.stringify(validatedProps), now, id);

  const row = db.prepare("SELECT * FROM databases WHERE id = ?").get(id) as DbRow;
  res.json(populateOptions(dbRowToDatabase(row)));
});

router.post("/:id/select-options", (req: Request<{ id: string }>, res: Response) => {
  const db = getDb();
  const { id: databaseId } = req.params;
  const { propertyId, value, color } = req.body;

  if (!propertyId || !value) {
    res.status(400).json({ error: "propertyId and value are required" });
    return;
  }

  const existingDb = db.prepare("SELECT * FROM databases WHERE id = ?").get(databaseId);
  if (!existingDb) {
    res.status(404).json({ error: "Database not found" });
    return;
  }

  const maxRow = db.prepare(
    "SELECT COALESCE(MAX(position), -1) AS max_pos FROM select_options WHERE database_id = ? AND property_id = ?"
  ).get(databaseId, propertyId) as { max_pos: number };

  const optionId = uuidv4();
  db.prepare(
    "INSERT INTO select_options (id, database_id, property_id, value, color, position) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(optionId, databaseId, propertyId, String(value), color || "gray", maxRow.max_pos + 1);

  const option = db.prepare("SELECT * FROM select_options WHERE id = ?").get(optionId) as SelectOptionRow;
  res.status(201).json(dbRowToSelectOption(option));
});

router.patch("/select-options/:id", (req: Request<{ id: string }>, res: Response) => {
  const db = getDb();
  const { id } = req.params;
  const { value, color } = req.body;

  const existing = db.prepare("SELECT * FROM select_options WHERE id = ?").get(id) as SelectOptionRow | undefined;
  if (!existing) {
    res.status(404).json({ error: "Select option not found" });
    return;
  }

  const newValue = value !== undefined ? String(value) : existing.value;
  const newColor = color !== undefined ? String(color) : existing.color;

  db.prepare("UPDATE select_options SET value = ?, color = ? WHERE id = ?")
    .run(newValue, newColor, id);

  const option = db.prepare("SELECT * FROM select_options WHERE id = ?").get(id) as SelectOptionRow;
  res.json(dbRowToSelectOption(option));
});

router.delete("/select-options/:id", (req: Request<{ id: string }>, res: Response) => {
  const db = getDb();
  const { id } = req.params;

  const existing = db.prepare("SELECT * FROM select_options WHERE id = ?").get(id);
  if (!existing) {
    res.status(404).json({ error: "Select option not found" });
    return;
  }

  db.prepare("DELETE FROM select_options WHERE id = ?").run(id);
  res.json({ success: true });
});

router.get("/by-row/:rowId", (_req: Request, res: Response) => {
  const db = getDb();
  const row = db.prepare("SELECT * FROM rows WHERE id = ?").get(_req.params.rowId) as RowRow | undefined;
  if (!row) {
    res.status(404).json({ error: "Row not found" });
    return;
  }
  res.json(dbRowToRow(row));
});

export default router;
