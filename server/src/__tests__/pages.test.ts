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
  // Store app on test context for use in tests
  (globalThis as any).__testApp = app;
});

afterEach(() => {
  db.close();
});

function getApp(): express.Express {
  return (globalThis as any).__testApp;
}

describe("pages routes (integration)", () => {
  describe("POST /api/pages", () => {
    it("creates a page and returns it", async () => {
      const res = await request(getApp())
        .post("/api/pages")
        .send({ title: "Test Page" })
        .expect(201);

      expect(res.body.title).toBe("Test Page");
      expect(res.body.id).toBeTruthy();
      expect(res.body.parentId).toBeNull();
    });

    it("creates a page with parent and icon", async () => {
      const parent = await request(getApp())
        .post("/api/pages")
        .send({ title: "Parent" });

      const res = await request(getApp())
        .post("/api/pages")
        .send({ title: "Child", parentId: parent.body.id, icon: "📄" })
        .expect(201);

      expect(res.body.title).toBe("Child");
      expect(res.body.parentId).toBe(parent.body.id);
      expect(res.body.icon).toBe("📄");
    });

    it("rejects empty title", async () => {
      await request(getApp())
        .post("/api/pages")
        .send({ title: "" })
        .expect(400);

      await request(getApp())
        .post("/api/pages")
        .send({ title: "   " })
        .expect(400);

      await request(getApp())
        .post("/api/pages")
        .send({})
        .expect(400);
    });
  });

  describe("GET /api/pages", () => {
    it("lists all pages", async () => {
      await request(getApp()).post("/api/pages").send({ title: "Alpha" });
      await request(getApp()).post("/api/pages").send({ title: "Beta" });
      await request(getApp()).post("/api/pages").send({ title: "Gamma" });

      const res = await request(getApp())
        .get("/api/pages")
        .expect(200);

      expect(res.body).toHaveLength(3);
      expect(res.body[0].title).toBe("Alpha");
      expect(res.body[1].title).toBe("Beta");
      expect(res.body[2].title).toBe("Gamma");
    });

    it("returns empty array when no pages", async () => {
      const res = await request(getApp())
        .get("/api/pages")
        .expect(200);

      expect(res.body).toHaveLength(0);
    });
  });

  describe("GET /api/pages/:id", () => {
    it("returns a single page", async () => {
      const created = await request(getApp())
        .post("/api/pages")
        .send({ title: "My Page", icon: "⭐" });

      const res = await request(getApp())
        .get(`/api/pages/${created.body.id}`)
        .expect(200);

      expect(res.body.title).toBe("My Page");
      expect(res.body.icon).toBe("⭐");
    });

    it("returns 404 for missing page", async () => {
      await request(getApp())
        .get("/api/pages/nonexistent")
        .expect(404);
    });
  });

  describe("PATCH /api/pages/:id", () => {
    it("updates a page title (rename)", async () => {
      const created = await request(getApp())
        .post("/api/pages")
        .send({ title: "Old Name" });

      const res = await request(getApp())
        .patch(`/api/pages/${created.body.id}`)
        .send({ title: "New Name" })
        .expect(200);

      expect(res.body.title).toBe("New Name");
    });

    it("updates icon and parentId", async () => {
      const parent = await request(getApp())
        .post("/api/pages")
        .send({ title: "Parent" });
      const child = await request(getApp())
        .post("/api/pages")
        .send({ title: "Child", icon: "🌟" });

      const res = await request(getApp())
        .patch(`/api/pages/${child.body.id}`)
        .send({ icon: "🔥", parentId: parent.body.id })
        .expect(200);

      expect(res.body.icon).toBe("🔥");
      expect(res.body.parentId).toBe(parent.body.id);
    });

    it("rejects empty title", async () => {
      const created = await request(getApp())
        .post("/api/pages")
        .send({ title: "Test" });

      await request(getApp())
        .patch(`/api/pages/${created.body.id}`)
        .send({ title: "" })
        .expect(400);
    });

    it("returns 404 for missing page", async () => {
      await request(getApp())
        .patch("/api/pages/nonexistent")
        .send({ title: "New" })
        .expect(404);
    });
  });

  describe("DELETE /api/pages/:id", () => {
    it("deletes a page", async () => {
      const created = await request(getApp())
        .post("/api/pages")
        .send({ title: "To Delete" });

      await request(getApp())
        .delete(`/api/pages/${created.body.id}`)
        .expect(200);

      await request(getApp())
        .get(`/api/pages/${created.body.id}`)
        .expect(404);
    });

    it("cascades delete to children", async () => {
      const parent = await request(getApp())
        .post("/api/pages")
        .send({ title: "Parent" });
      const child = await request(getApp())
        .post("/api/pages")
        .send({ title: "Child", parentId: parent.body.id });
      const grandchild = await request(getApp())
        .post("/api/pages")
        .send({ title: "Grandchild", parentId: child.body.id });

      await request(getApp())
        .delete(`/api/pages/${parent.body.id}`)
        .expect(200);

      await request(getApp())
        .get(`/api/pages/${parent.body.id}`)
        .expect(404);
      await request(getApp())
        .get(`/api/pages/${child.body.id}`)
        .expect(404);
      await request(getApp())
        .get(`/api/pages/${grandchild.body.id}`)
        .expect(404);
    });

    it("returns 404 for missing page", async () => {
      await request(getApp())
        .delete("/api/pages/nonexistent")
        .expect(404);
    });
  });
});
