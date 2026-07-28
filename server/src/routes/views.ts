import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../db";

interface ViewRow {
  id: string;
  database_id: string;
  type: string;
  name: string;
  filters: string;
  sort_field: string | null;
  sort_direction: string;
  group_field: string | null;
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

interface Filter {
  id: string;
  field: string;
  operator: string;
  value: unknown;
}

function dbRowToView(row: ViewRow) {
  return {
    id: row.id,
    databaseId: row.database_id,
    type: row.type as "table" | "board" | "list",
    name: row.name,
    filters: JSON.parse(row.filters || "[]"),
    sortField: row.sort_field,
    sortDirection: row.sort_direction as "asc" | "desc",
    groupField: row.group_field,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function isFilterOperator(operator: string): boolean {
  const validOperators = [
    "contains", "not_contains", "is", "is_not", "is_empty", "is_not_empty",
    "is_before", "is_after",
  ];
  return validOperators.includes(operator);
}

function buildFilterWhere(filters: Filter[]): { where: string; params: unknown[] } {
  if (!filters || filters.length === 0) {
    return { where: "", params: [] };
  }

  const clauses: string[] = [];
  const params: unknown[] = [];

  for (const filter of filters) {
    if (!filter.field || !filter.operator || !isFilterOperator(filter.operator)) {
      continue;
    }

    const { field, operator, value } = filter;

    switch (operator) {
      case "contains":
        clauses.push("json_extract(data, ?) LIKE ?");
        params.push(`$.${field}`, `%${value}%`);
        break;
      case "not_contains":
        clauses.push("(json_extract(data, ?) NOT LIKE ? OR json_extract(data, ?) IS NULL)");
        params.push(`$.${field}`, `%${value}%`, `$.${field}`);
        break;
      case "is":
        if (typeof value === "boolean") {
          clauses.push("json_extract(data, ?) = ?");
          params.push(`$.${field}`, value ? 1 : 0);
        } else {
          clauses.push("json_extract(data, ?) = ?");
          params.push(`$.${field}`, value);
        }
        break;
      case "is_not":
        clauses.push("(json_extract(data, ?) != ? OR json_extract(data, ?) IS NULL)");
        params.push(`$.${field}`, value, `$.${field}`);
        break;
      case "is_empty":
        clauses.push("(json_extract(data, ?) IS NULL OR json_extract(data, ?) = '')");
        params.push(`$.${field}`, `$.${field}`);
        break;
      case "is_not_empty":
        clauses.push("(json_extract(data, ?) IS NOT NULL AND json_extract(data, ?) != '')");
        params.push(`$.${field}`, `$.${field}`);
        break;
      case "is_before":
        clauses.push("json_extract(data, ?) < ?");
        params.push(`$.${field}`, value);
        break;
      case "is_after":
        clauses.push("json_extract(data, ?) > ?");
        params.push(`$.${field}`, value);
        break;
    }
  }

  if (clauses.length === 0) {
    return { where: "", params: [] };
  }

  return { where: " AND " + clauses.join(" AND "), params };
}

const VALID_VIEW_TYPES = ["table", "board", "list"] as const;

const router = Router();

router.get("/databases/:id/views", (req: Request<{ id: string }>, res: Response) => {
  const db = getDb();
  const rows = db.prepare(
    "SELECT * FROM views WHERE database_id = ? ORDER BY created_at ASC"
  ).all(req.params.id) as ViewRow[];
  res.json(rows.map(dbRowToView));
});

router.post("/databases/:id/views", (req: Request<{ id: string }>, res: Response) => {
  const db = getDb();
  const databaseId = req.params.id;
  const { type, name, filters, sortField, sortDirection, groupField } = req.body;

  const existingDb = db.prepare("SELECT * FROM databases WHERE id = ?").get(databaseId);
  if (!existingDb) {
    res.status(404).json({ error: "Database not found" });
    return;
  }

  const id = uuidv4();
  const now = new Date().toISOString();
  const viewType = VALID_VIEW_TYPES.includes(type as typeof VALID_VIEW_TYPES[number]) ? type : "table";
  const viewName = name || "";
  const viewFilters = Array.isArray(filters) ? filters : [];
  const viewSortField = sortField || null;
  const viewSortDirection = sortDirection === "desc" ? "desc" : "asc";
  const viewGroupField = groupField || null;

  db.prepare(
    "INSERT INTO views (id, database_id, type, name, filters, sort_field, sort_direction, group_field, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(id, databaseId, viewType, viewName, JSON.stringify(viewFilters), viewSortField, viewSortDirection, viewGroupField, now, now);

  const row = db.prepare("SELECT * FROM views WHERE id = ?").get(id) as ViewRow;
  res.status(201).json(dbRowToView(row));
});

router.patch("/views/:id", (req: Request<{ id: string }>, res: Response) => {
  const db = getDb();
  const { id } = req.params;
  const { type, name, filters, sortField, sortDirection, groupField } = req.body;

  const existing = db.prepare("SELECT * FROM views WHERE id = ?").get(id) as ViewRow | undefined;
  if (!existing) {
    res.status(404).json({ error: "View not found" });
    return;
  }

  const now = new Date().toISOString();
  const newType = type !== undefined
    ? (VALID_VIEW_TYPES.includes(type as typeof VALID_VIEW_TYPES[number]) ? type : existing.type)
    : existing.type;
  const newName = name !== undefined ? String(name) : existing.name;
  const newFilters = filters !== undefined ? JSON.stringify(filters) : existing.filters;
  const newSortField = sortField !== undefined ? (sortField || null) : existing.sort_field;
  const newSortDirection = sortDirection !== undefined
    ? (sortDirection === "desc" ? "desc" : "asc")
    : existing.sort_direction;
  const newGroupField = groupField !== undefined ? (groupField || null) : existing.group_field;

  db.prepare(
    "UPDATE views SET type = ?, name = ?, filters = ?, sort_field = ?, sort_direction = ?, group_field = ?, updated_at = ? WHERE id = ?"
  ).run(newType, newName, newFilters, newSortField, newSortDirection, newGroupField, now, id);

  const row = db.prepare("SELECT * FROM views WHERE id = ?").get(id) as ViewRow;
  res.json(dbRowToView(row));
});

router.delete("/views/:id", (req: Request<{ id: string }>, res: Response) => {
  const db = getDb();
  const { id } = req.params;

  const existing = db.prepare("SELECT * FROM views WHERE id = ?").get(id);
  if (!existing) {
    res.status(404).json({ error: "View not found" });
    return;
  }

  db.prepare("DELETE FROM views WHERE id = ?").run(id);
  res.json({ success: true });
});

export function getRowsWithFilterSort(
  databaseId: string,
  sortField?: string,
  sortDir?: string,
  filterJson?: string
): RowRow[] {
  const db = getDb();

  let query = "SELECT * FROM rows WHERE database_id = ?";
  const params: unknown[] = [databaseId];

  if (filterJson) {
    try {
      const filters: Filter[] = JSON.parse(filterJson);
      const { where, params: filterParams } = buildFilterWhere(filters);
      if (where) {
        query += where;
        params.push(...filterParams);
      }
    } catch {
      // Invalid filter JSON, ignore
    }
  }

  const direction = sortDir === "desc" ? "DESC" : "ASC";
  if (sortField) {
    query += ` ORDER BY json_extract(data, '$.${sortField}') ${direction}`;
  } else {
    query += " ORDER BY created_at ASC";
  }

  return db.prepare(query).all(...params) as RowRow[];
}

export default router;
