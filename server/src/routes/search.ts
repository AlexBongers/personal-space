import { Router, Request, Response } from "express";
import { getDb } from "../db";

interface PageRow {
  id: string;
  title: string;
  parent_id: string | null;
  icon: string | null;
}

interface RowRow {
  id: string;
  database_id: string;
  title: string;
  page_id: string | null;
}

interface DbRow {
  id: string;
  title: string;
  name: string;
  page_id: string;
  parent_id: string | null;
  icon: string | null;
}

interface SearchResult {
  id: string;
  title: string;
  type: "page" | "row";
  icon: string;
  parentChain: { id: string; title: string }[];
}

const router = Router();

function buildParentChain(pageId: string, pages: PageRow[]): { id: string; title: string }[] {
  const chain: { id: string; title: string }[] = [];
  const pageMap = new Map<string, PageRow>();
  for (const p of pages) {
    pageMap.set(p.id, p);
  }

  let current = pageMap.get(pageId);
  while (current) {
    chain.unshift({ id: current.id, title: current.title });
    current = current.parent_id ? pageMap.get(current.parent_id) : undefined;
  }

  return chain;
}

function scoreResult(title: string, query: string): number {
  const lowerTitle = title.toLowerCase();
  const lowerQuery = query.toLowerCase();
  if (lowerTitle === lowerQuery) return 3;
  if (lowerTitle.startsWith(lowerQuery)) return 2;
  if (lowerTitle.includes(lowerQuery)) return 1;
  return 0;
}

router.get("/", (req: Request, res: Response) => {
  const { q } = req.query;

  if (!q || typeof q !== "string" || q.trim().length === 0) {
    res.json([]);
    return;
  }

  const db = getDb();
  const query = q.trim();

  const allPages = db.prepare("SELECT id, title, parent_id, icon FROM pages").all() as PageRow[];

  const pageResults = allPages.filter((p) =>
    p.title.toLowerCase().includes(query.toLowerCase())
  );

  const dbRows = db.prepare(
    "SELECT r.id, r.database_id, r.title, r.page_id, d.name FROM rows r LEFT JOIN databases d ON r.database_id = d.id WHERE r.title LIKE ?"
  ).all(`%${query}%`) as (RowRow & { name: string | null })[];

  const results: SearchResult[] = [];

  for (const page of pageResults) {
    const score = scoreResult(page.title, query);
    if (score > 0) {
      const parentChain = buildParentChain(page.id, allPages);
      results.push({
        id: page.id,
        title: page.title,
        type: "page",
        icon: page.icon || "📄",
        parentChain: parentChain.slice(0, -1),
      });
    }
  }

  for (const row of dbRows) {
    const score = scoreResult(row.title, query);
    if (score > 0) {
      const parentChain = row.page_id
        ? buildParentChain(row.page_id, allPages)
        : [];
      results.push({
        id: row.id,
        title: row.title,
        type: "row",
        icon: "📋",
        parentChain,
      });
    }
  }

  results.sort((a, b) => {
    const scoreA = scoreResult(a.title, query);
    const scoreB = scoreResult(b.title, query);
    if (scoreB !== scoreA) return scoreB - scoreA;
    return a.title.localeCompare(b.title);
  });

  res.json(results);
});

export default router;
