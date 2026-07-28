import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import Database from "better-sqlite3";
import { createTestApp } from "./helpers/testApp";
import { getDb } from "../db";
import express from "express";

let db: Database.Database;

beforeEach(() => {
  const app = createTestApp() as any;
  db = getDb();
  (globalThis as any).__testApp = app;
});

afterEach(() => {
  db.close();
});

function getApp(): express.Express {
  return (globalThis as any).__testApp;
}

async function createPage(): Promise<string> {
  const res = await request(getApp())
    .post("/api/pages")
    .send({ title: "Test Page" });
  return res.body.id;
}

describe("blocks routes (integration)", () => {
  describe("POST /api/pages/:pageId/blocks", () => {
    it("creates a paragraph block", async () => {
      const pageId = await createPage();

      const res = await request(getApp())
        .post(`/api/pages/${pageId}/blocks`)
        .send({ type: "paragraph", content: "Hello world" })
        .expect(201);

      expect(res.body.type).toBe("paragraph");
      expect(res.body.content).toBe("Hello world");
      expect(res.body.position).toBe(0);
      expect(res.body.checked).toBe(false);
    });

    it("creates different block types", async () => {
      const pageId = await createPage();

      await request(getApp())
        .post(`/api/pages/${pageId}/blocks`)
        .send({ type: "heading1", content: "Big Title" })
        .expect(201);

      await request(getApp())
        .post(`/api/pages/${pageId}/blocks`)
        .send({ type: "todo", content: "Buy groceries" })
        .expect(201);

      const res = await request(getApp())
        .get(`/api/pages/${pageId}/blocks`)
        .expect(200);

      expect(res.body).toHaveLength(2);
      expect(res.body[0].type).toBe("heading1");
      expect(res.body[1].type).toBe("todo");
    });

    it("rejects invalid block type", async () => {
      const pageId = await createPage();

      await request(getApp())
        .post(`/api/pages/${pageId}/blocks`)
        .send({ type: "invalid_type" })
        .expect(400);
    });

    it("returns 404 for missing page", async () => {
      await request(getApp())
        .post("/api/pages/nonexistent/blocks")
        .send({ type: "paragraph", content: "Test" })
        .expect(404);
    });
  });

  describe("GET /api/pages/:pageId/blocks", () => {
    it("gets blocks ordered by position", async () => {
      const pageId = await createPage();

      await request(getApp())
        .post(`/api/pages/${pageId}/blocks`)
        .send({ type: "paragraph", content: "C", position: 2 });
      await request(getApp())
        .post(`/api/pages/${pageId}/blocks`)
        .send({ type: "paragraph", content: "A", position: 0 });
      await request(getApp())
        .post(`/api/pages/${pageId}/blocks`)
        .send({ type: "paragraph", content: "B", position: 1 });

      const res = await request(getApp())
        .get(`/api/pages/${pageId}/blocks`)
        .expect(200);

      expect(res.body).toHaveLength(3);
      expect(res.body[0].content).toBe("A");
      expect(res.body[1].content).toBe("B");
      expect(res.body[2].content).toBe("C");
    });

    it("returns 404 for non-existent page", async () => {
      await request(getApp())
        .get("/api/pages/nonexistent/blocks")
        .expect(404);
    });
  });

  describe("PATCH /api/blocks/:id", () => {
    it("updates block content", async () => {
      const pageId = await createPage();
      const created = await request(getApp())
        .post(`/api/pages/${pageId}/blocks`)
        .send({ type: "paragraph", content: "Old content" });

      const res = await request(getApp())
        .patch(`/api/blocks/${created.body.id}`)
        .send({ content: "New content" })
        .expect(200);

      expect(res.body.content).toBe("New content");
    });

    it("toggles todo checked state", async () => {
      const pageId = await createPage();
      const created = await request(getApp())
        .post(`/api/pages/${pageId}/blocks`)
        .send({ type: "todo", content: "Task 1" });

      let res = await request(getApp())
        .patch(`/api/blocks/${created.body.id}`)
        .send({ checked: true })
        .expect(200);

      expect(res.body.checked).toBe(true);

      res = await request(getApp())
        .patch(`/api/blocks/${created.body.id}`)
        .send({ checked: false })
        .expect(200);

      expect(res.body.checked).toBe(false);
    });

    it("returns 404 for missing block", async () => {
      await request(getApp())
        .patch("/api/blocks/nonexistent")
        .send({ content: "Test" })
        .expect(404);
    });
  });

  describe("DELETE /api/blocks/:id", () => {
    it("deletes a block", async () => {
      const pageId = await createPage();
      const created = await request(getApp())
        .post(`/api/pages/${pageId}/blocks`)
        .send({ type: "paragraph", content: "To delete" });

      await request(getApp())
        .delete(`/api/blocks/${created.body.id}`)
        .expect(200);

      await request(getApp())
        .get(`/api/pages/${pageId}/blocks`)
        .expect(200)
        .expect((res) => expect(res.body).toHaveLength(0));
    });

    it("returns 404 for missing block", async () => {
      await request(getApp())
        .delete("/api/blocks/nonexistent")
        .expect(404);
    });
  });

  describe("PATCH /api/blocks/reorder", () => {
    it("reorders blocks", async () => {
      const pageId = await createPage();

      const b1 = await request(getApp())
        .post(`/api/pages/${pageId}/blocks`)
        .send({ type: "paragraph", content: "First", position: 0 });
      const b2 = await request(getApp())
        .post(`/api/pages/${pageId}/blocks`)
        .send({ type: "paragraph", content: "Second", position: 1 });
      const b3 = await request(getApp())
        .post(`/api/pages/${pageId}/blocks`)
        .send({ type: "paragraph", content: "Third", position: 2 });

      await request(getApp())
        .patch("/api/blocks/reorder")
        .send({
          blocks: [
            { id: b2.body.id, position: 0 },
            { id: b3.body.id, position: 1 },
            { id: b1.body.id, position: 2 },
          ],
        })
        .expect(200);

      const res = await request(getApp())
        .get(`/api/pages/${pageId}/blocks`)
        .expect(200);

      expect(res.body[0].content).toBe("Second");
      expect(res.body[1].content).toBe("Third");
      expect(res.body[2].content).toBe("First");
    });

    it("rejects missing blocks array", async () => {
      await request(getApp())
        .patch("/api/blocks/reorder")
        .send({})
        .expect(400);
    });
  });

  describe("all block types", () => {
    it("handles all supported block types", async () => {
      const pageId = await createPage();

      const types = [
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

      for (let i = 0; i < types.length; i++) {
        await request(getApp())
          .post(`/api/pages/${pageId}/blocks`)
          .send({ type: types[i], content: `${types[i]} content`, position: i })
          .expect(201);
      }

      const res = await request(getApp())
        .get(`/api/pages/${pageId}/blocks`)
        .expect(200);

      expect(res.body).toHaveLength(types.length);
      for (let i = 0; i < types.length; i++) {
        expect(res.body[i].type).toBe(types[i]);
        expect(res.body[i].content).toBe(`${types[i]} content`);
      }
    });
  });
});
