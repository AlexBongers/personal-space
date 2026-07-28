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

async function createPage(title: string, parentId: string | null = null): Promise<string> {
  const res = await request(getApp())
    .post("/api/pages")
    .send({ title, parentId });
  return res.body.id;
}

describe("databases routes (integration)", () => {
  describe("POST /api/databases", () => {
    it("creates a database", async () => {
      const pageId = await createPage("Projects");

      const res = await request(getApp())
        .post("/api/databases")
        .send({ pageId, name: "Task Tracker", properties: [] })
        .expect(201);

      expect(res.body.name).toBe("Task Tracker");
      expect(res.body.pageId).toBe(pageId);
    });

    it("creates a database with properties", async () => {
      const pageId = await createPage("My DB");
      const props = [
        { id: "prop-1", name: "Status", type: "select" },
        { id: "prop-2", name: "Due Date", type: "date" },
      ];

      const res = await request(getApp())
        .post("/api/databases")
        .send({ pageId, name: "My DB", properties: props })
        .expect(201);

      expect(res.body.properties).toHaveLength(2);
      expect(res.body.properties[0].name).toBe("Status");
      expect(res.body.properties[1].name).toBe("Due Date");
    });

    it("creates default views", async () => {
      const pageId = await createPage("My DB");
      const res = await request(getApp())
        .post("/api/databases")
        .send({ pageId, name: "My DB" })
        .expect(201);

      const views = await request(getApp())
        .get(`/api/databases/${res.body.id}/views`)
        .expect(200);

      expect(views.body).toHaveLength(3);
      expect(views.body.map((v: any) => v.type)).toContain("table");
      expect(views.body.map((v: any) => v.type)).toContain("board");
      expect(views.body.map((v: any) => v.type)).toContain("list");
    });

    it("rejects missing pageId", async () => {
      await request(getApp())
        .post("/api/databases")
        .send({ name: "Test" })
        .expect(400);
    });
  });

  describe("GET /api/databases/:id", () => {
    it("returns a database by ID", async () => {
      const pageId = await createPage("My DB");
      const created = await request(getApp())
        .post("/api/databases")
        .send({ pageId, name: "My DB" });

      const res = await request(getApp())
        .get(`/api/databases/${created.body.id}`)
        .expect(200);

      expect(res.body.name).toBe("My DB");
    });

    it("returns 404 for missing database", async () => {
      await request(getApp())
        .get("/api/databases/nonexistent")
        .expect(404);
    });
  });

  describe("GET /api/databases/by-page/:pageId", () => {
    it("returns a database by page ID", async () => {
      const pageId = await createPage("My DB");
      const created = await request(getApp())
        .post("/api/databases")
        .send({ pageId, name: "My DB" });

      const res = await request(getApp())
        .get(`/api/databases/by-page/${pageId}`)
        .expect(200);

      expect(res.body.name).toBe("My DB");
    });

    it("returns 404 for non-database page", async () => {
      const pageId = await createPage("Just a Page");
      await request(getApp())
        .get(`/api/databases/by-page/${pageId}`)
        .expect(404);
    });
  });

  describe("PATCH /api/databases/:id", () => {
    it("updates database name", async () => {
      const pageId = await createPage("Old Name");
      const created = await request(getApp())
        .post("/api/databases")
        .send({ pageId, name: "Old Name" });

      const res = await request(getApp())
        .patch(`/api/databases/${created.body.id}`)
        .send({ name: "New Name" })
        .expect(200);

      expect(res.body.name).toBe("New Name");
    });

    it("returns 404 for missing database", async () => {
      await request(getApp())
        .patch("/api/databases/nonexistent")
        .send({ name: "Test" })
        .expect(404);
    });
  });

  describe("PATCH /api/databases/:id/properties", () => {
    it("updates properties", async () => {
      const pageId = await createPage("Tasks");
      const created = await request(getApp())
        .post("/api/databases")
        .send({ pageId, name: "Tasks" });

      const props = [{ id: "prop-1", name: "Status", type: "select" }];
      const res = await request(getApp())
        .patch(`/api/databases/${created.body.id}/properties`)
        .send({ properties: props })
        .expect(200);

      expect(res.body.properties).toHaveLength(1);
      expect(res.body.properties[0].name).toBe("Status");
    });

    it("rejects non-array properties", async () => {
      const pageId = await createPage("Tasks");
      const created = await request(getApp())
        .post("/api/databases")
        .send({ pageId, name: "Tasks" });

      await request(getApp())
        .patch(`/api/databases/${created.body.id}/properties`)
        .send({ properties: "invalid" })
        .expect(400);
    });
  });

  describe("POST /api/databases/:id/rows", () => {
    it("creates a row", async () => {
      const pageId = await createPage("Tasks");
      const dbRes = await request(getApp())
        .post("/api/databases")
        .send({ pageId, name: "Tasks" });
      const dbId = dbRes.body.id;

      const rowRes = await request(getApp())
        .post(`/api/databases/${dbId}/rows`)
        .send({ title: "Design landing page", data: { status: "In Progress" } })
        .expect(201);

      expect(rowRes.body.title).toBe("Design landing page");
      expect(rowRes.body.data).toEqual({ status: "In Progress" });
    });

    it("returns 404 for missing database", async () => {
      await request(getApp())
        .post("/api/databases/nonexistent/rows")
        .send({ title: "Test" })
        .expect(404);
    });
  });

  describe("GET /api/databases/:id/rows", () => {
    it("lists rows", async () => {
      const pageId = await createPage("Tasks");
      const dbRes = await request(getApp())
        .post("/api/databases")
        .send({ pageId, name: "Tasks" });
      const dbId = dbRes.body.id;

      await request(getApp())
        .post(`/api/databases/${dbId}/rows`)
        .send({ title: "Task 1" });
      await request(getApp())
        .post(`/api/databases/${dbId}/rows`)
        .send({ title: "Task 2" });

      const res = await request(getApp())
        .get(`/api/databases/${dbId}/rows`)
        .expect(200);

      expect(res.body).toHaveLength(2);
    });
  });

  describe("PATCH /api/databases/rows/:id", () => {
    it("updates row data", async () => {
      const pageId = await createPage("Tasks");
      const dbRes = await request(getApp())
        .post("/api/databases")
        .send({ pageId, name: "Tasks" });
      const dbId = dbRes.body.id;

      const row = await request(getApp())
        .post(`/api/databases/${dbId}/rows`)
        .send({ title: "Task 1", data: { done: false } });

      const res = await request(getApp())
        .patch(`/api/databases/rows/${row.body.id}`)
        .send({ data: { done: true } })
        .expect(200);

      expect(res.body.data).toEqual({ done: true });
    });

    it("returns 404 for missing row", async () => {
      await request(getApp())
        .patch("/api/databases/rows/nonexistent")
        .send({ title: "Test" })
        .expect(404);
    });
  });

  describe("DELETE /api/databases/rows/:id", () => {
    it("deletes a row", async () => {
      const pageId = await createPage("Tasks");
      const dbRes = await request(getApp())
        .post("/api/databases")
        .send({ pageId, name: "Tasks" });
      const dbId = dbRes.body.id;

      const row = await request(getApp())
        .post(`/api/databases/${dbId}/rows`)
        .send({ title: "To Delete" });

      await request(getApp())
        .delete(`/api/databases/rows/${row.body.id}`)
        .expect(200);
    });
  });

  describe("POST /api/databases/:id/select-options", () => {
    it("creates a select option", async () => {
      const pageId = await createPage("Tasks");
      const propId = "status-prop";
      const props = [{ id: propId, name: "Status", type: "select" }];
      const dbRes = await request(getApp())
        .post("/api/databases")
        .send({ pageId, name: "Tasks", properties: props });
      const dbId = dbRes.body.id;

      const res = await request(getApp())
        .post(`/api/databases/${dbId}/select-options`)
        .send({ propertyId: propId, value: "Backlog", color: "gray" })
        .expect(201);

      expect(res.body.value).toBe("Backlog");
      expect(res.body.color).toBe("gray");
    });

    it("rejects missing propertyId", async () => {
      const pageId = await createPage("Tasks");
      const dbRes = await request(getApp())
        .post("/api/databases")
        .send({ pageId, name: "Tasks" });

      await request(getApp())
        .post(`/api/databases/${dbRes.body.id}/select-options`)
        .send({ value: "Test" })
        .expect(400);
    });
  });

  describe("PATCH /api/databases/select-options/:id", () => {
    it("updates a select option", async () => {
      const pageId = await createPage("Tasks");
      const propId = "status-prop";
      const dbRes = await request(getApp())
        .post("/api/databases")
        .send({
          pageId,
          name: "Tasks",
          properties: [{ id: propId, name: "Status", type: "select" }],
        });
      const dbId = dbRes.body.id;

      const opt = await request(getApp())
        .post(`/api/databases/${dbId}/select-options`)
        .send({ propertyId: propId, value: "Old", color: "gray" });

      const res = await request(getApp())
        .patch(`/api/databases/select-options/${opt.body.id}`)
        .send({ value: "New", color: "red" })
        .expect(200);

      expect(res.body.value).toBe("New");
      expect(res.body.color).toBe("red");
    });
  });

  describe("DELETE /api/databases/select-options/:id", () => {
    it("deletes a select option", async () => {
      const pageId = await createPage("Tasks");
      const propId = "status-prop";
      const dbRes = await request(getApp())
        .post("/api/databases")
        .send({
          pageId,
          name: "Tasks",
          properties: [{ id: propId, name: "Status", type: "select" }],
        });
      const dbId = dbRes.body.id;

      const opt = await request(getApp())
        .post(`/api/databases/${dbId}/select-options`)
        .send({ propertyId: propId, value: "Test", color: "gray" });

      await request(getApp())
        .delete(`/api/databases/select-options/${opt.body.id}`)
        .expect(200);
    });
  });

  describe("all 7 property types", () => {
    it("handles all property types", async () => {
      const pageId = await createPage("All Types");
      const props = [
        { id: "p1", name: "Name", type: "text" },
        { id: "p2", name: "Price", type: "number" },
        { id: "p3", name: "Status", type: "select" },
        { id: "p4", name: "Tags", type: "multi-select" },
        { id: "p5", name: "Due Date", type: "date" },
        { id: "p6", name: "Done", type: "checkbox" },
        { id: "p7", name: "Link", type: "url" },
      ];

      const dbRes = await request(getApp())
        .post("/api/databases")
        .send({ pageId, name: "All Types", properties: props })
        .expect(201);

      expect(dbRes.body.properties).toHaveLength(7);
      expect(dbRes.body.properties[0].name).toBe("Name");
      expect(dbRes.body.properties[0].type).toBe("text");
      expect(dbRes.body.properties[6].name).toBe("Link");
      expect(dbRes.body.properties[6].type).toBe("url");

      const rowData: Record<string, unknown> = {
        p1: "Widget",
        p2: 42,
        p3: "In Progress",
        p4: ["urgent", "blocked"],
        p5: "2025-06-01",
        p6: false,
        p7: "https://example.com",
      };

      const row = await request(getApp())
        .post(`/api/databases/${dbRes.body.id}/rows`)
        .send({ title: "Widget", data: rowData })
        .expect(201);

      expect(row.body.data.p1).toBe("Widget");
      expect(row.body.data.p2).toBe(42);
      expect(row.body.data.p5).toBe("2025-06-01");
      expect(row.body.data.p6).toBe(false);
    });
  });
});
