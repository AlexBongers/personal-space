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

async function createPageAndDb(name: string, properties: object[] = []): Promise<string> {
  const page = await request(getApp())
    .post("/api/pages")
    .send({ title: name });
  const dbRes = await request(getApp())
    .post("/api/databases")
    .send({ pageId: page.body.id, name, properties });
  return dbRes.body.id;
}

describe("views routes (integration)", () => {
  describe("GET /api/databases/:id/views", () => {
    it("gets all views for a database", async () => {
      const dbId = await createPageAndDb("Tasks");
      const res = await request(getApp())
        .get(`/api/databases/${dbId}/views`)
        .expect(200);

      expect(res.body).toHaveLength(3);
      expect(res.body[0].type).toBe("table");
      expect(res.body[1].type).toBe("board");
      expect(res.body[2].type).toBe("list");
    });
  });

  describe("POST /api/databases/:id/views", () => {
    it("creates a view with settings", async () => {
      const dbId = await createPageAndDb("Tasks");

      const res = await request(getApp())
        .post(`/api/databases/${dbId}/views`)
        .send({ type: "board", name: "Kanban", sortField: null, sortDirection: "desc" })
        .expect(201);

      expect(res.body.type).toBe("board");
      expect(res.body.name).toBe("Kanban");
      expect(res.body.sortDirection).toBe("desc");
    });

    it("creates all three view types", async () => {
      const dbId = await createPageAndDb("Projects");

      const t = await request(getApp())
        .post(`/api/databases/${dbId}/views`)
        .send({ type: "table", name: "Custom Table" })
        .expect(201);
      expect(t.body.type).toBe("table");

      const b = await request(getApp())
        .post(`/api/databases/${dbId}/views`)
        .send({ type: "board", name: "Custom Board" })
        .expect(201);
      expect(b.body.type).toBe("board");

      const l = await request(getApp())
        .post(`/api/databases/${dbId}/views`)
        .send({ type: "list", name: "Custom List" })
        .expect(201);
      expect(l.body.type).toBe("list");
    });

    it("returns 404 for missing database", async () => {
      await request(getApp())
        .post("/api/databases/nonexistent/views")
        .send({ type: "table" })
        .expect(404);
    });
  });

  describe("PATCH /api/views/:id", () => {
    it("updates view settings", async () => {
      const dbId = await createPageAndDb("Tasks");
      const views = await request(getApp())
        .get(`/api/databases/${dbId}/views`);
      const viewId = views.body[0].id;

      const res = await request(getApp())
        .patch(`/api/views/${viewId}`)
        .send({ name: "Renamed View", sortDirection: "desc" })
        .expect(200);

      expect(res.body.name).toBe("Renamed View");
      expect(res.body.sortDirection).toBe("desc");
    });

    it("updates view filters", async () => {
      const dbId = await createPageAndDb("Tasks");
      const views = await request(getApp())
        .get(`/api/databases/${dbId}/views`);
      const viewId = views.body[0].id;

      const filters = [{ id: "f1", field: "status", operator: "is", value: "Done" }];
      const res = await request(getApp())
        .patch(`/api/views/${viewId}`)
        .send({ filters })
        .expect(200);

      expect(res.body.filters).toHaveLength(1);
      expect(res.body.filters[0].field).toBe("status");
    });

    it("returns 404 for missing view", async () => {
      await request(getApp())
        .patch("/api/views/nonexistent")
        .send({ name: "Test" })
        .expect(404);
    });
  });

  describe("DELETE /api/views/:id", () => {
    it("deletes a view", async () => {
      const dbId = await createPageAndDb("Tasks");
      const views = await request(getApp())
        .get(`/api/databases/${dbId}/views`);
      const viewId = views.body[0].id;

      await request(getApp())
        .delete(`/api/views/${viewId}`)
        .expect(200);
    });
  });

  describe("filtering rows", () => {
    async function setupFilterTest() {
      const propId = "status-prop";
      const dbId = await createPageAndDb("Tasks", [{ id: propId, name: "Status", type: "select" }]);

      await request(getApp())
        .post(`/api/databases/${dbId}/rows`)
        .send({ title: "Task 1", data: { [propId]: "Done" } });
      await request(getApp())
        .post(`/api/databases/${dbId}/rows`)
        .send({ title: "Task 2", data: { [propId]: "In Progress" } });
      await request(getApp())
        .post(`/api/databases/${dbId}/rows`)
        .send({ title: "Task 3", data: { [propId]: "Done" } });

      return { dbId, propId };
    }

    it("filters rows where select field equals a value", async () => {
      const { dbId, propId } = await setupFilterTest();

      const res = await request(getApp())
        .get(`/api/databases/${dbId}/rows`)
        .query({ filter: JSON.stringify([{ field: propId, operator: "is", value: "Done" }]) })
        .expect(200);

      expect(res.body).toHaveLength(2);
      expect(res.body[0].title).toBe("Task 1");
      expect(res.body[1].title).toBe("Task 3");
    });

    it("filters rows where select field is not a value", async () => {
      const { dbId, propId } = await setupFilterTest();

      const res = await request(getApp())
        .get(`/api/databases/${dbId}/rows`)
        .query({ filter: JSON.stringify([{ field: propId, operator: "is_not", value: "Done" }]) })
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].title).toBe("Task 2");
    });

    it("filters by text contains", async () => {
      const propId = "name-prop";
      const dbId = await createPageAndDb("Tasks", [{ id: propId, name: "Name", type: "text" }]);
      await request(getApp())
        .post(`/api/databases/${dbId}/rows`)
        .send({ title: "Alpha", data: { [propId]: "hello world" } });
      await request(getApp())
        .post(`/api/databases/${dbId}/rows`)
        .send({ title: "Beta", data: { [propId]: "goodbye" } });

      const res = await request(getApp())
        .get(`/api/databases/${dbId}/rows`)
        .query({ filter: JSON.stringify([{ field: propId, operator: "contains", value: "hello" }]) })
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].title).toBe("Alpha");
    });

    it("filters by checkbox", async () => {
      const propId = "done-prop";
      const dbId = await createPageAndDb("Tasks", [{ id: propId, name: "Done", type: "checkbox" }]);
      await request(getApp())
        .post(`/api/databases/${dbId}/rows`)
        .send({ title: "Task 1", data: { [propId]: true } });
      await request(getApp())
        .post(`/api/databases/${dbId}/rows`)
        .send({ title: "Task 2", data: { [propId]: false } });

      const res = await request(getApp())
        .get(`/api/databases/${dbId}/rows`)
        .query({ filter: JSON.stringify([{ field: propId, operator: "is", value: true }]) })
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].title).toBe("Task 1");
    });

    it("filters by date before/after", async () => {
      const propId = "date-prop";
      const dbId = await createPageAndDb("Tasks", [{ id: propId, name: "Date", type: "date" }]);
      await request(getApp())
        .post(`/api/databases/${dbId}/rows`)
        .send({ title: "Early", data: { [propId]: "2025-01-01" } });
      await request(getApp())
        .post(`/api/databases/${dbId}/rows`)
        .send({ title: "Late", data: { [propId]: "2025-12-31" } });

      const res = await request(getApp())
        .get(`/api/databases/${dbId}/rows`)
        .query({ filter: JSON.stringify([{ field: propId, operator: "is_before", value: "2025-06-01" }]) })
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].title).toBe("Early");
    });
  });

  describe("sorting rows", () => {
    it("sorts rows ascending by a field", async () => {
      const propId = "priority-prop";
      const dbId = await createPageAndDb("Tasks", [{ id: propId, name: "Priority", type: "number" }]);
      await request(getApp())
        .post(`/api/databases/${dbId}/rows`)
        .send({ title: "Task C", data: { [propId]: 3 } });
      await request(getApp())
        .post(`/api/databases/${dbId}/rows`)
        .send({ title: "Task A", data: { [propId]: 1 } });
      await request(getApp())
        .post(`/api/databases/${dbId}/rows`)
        .send({ title: "Task B", data: { [propId]: 2 } });

      const res = await request(getApp())
        .get(`/api/databases/${dbId}/rows`)
        .query({ sortField: propId, sortDir: "asc" })
        .expect(200);

      expect(res.body[0].title).toBe("Task A");
      expect(res.body[1].title).toBe("Task B");
      expect(res.body[2].title).toBe("Task C");
    });

    it("sorts rows descending", async () => {
      const propId = "priority-prop";
      const dbId = await createPageAndDb("Tasks", [{ id: propId, name: "Priority", type: "number" }]);
      await request(getApp())
        .post(`/api/databases/${dbId}/rows`)
        .send({ title: "Task C", data: { [propId]: 3 } });
      await request(getApp())
        .post(`/api/databases/${dbId}/rows`)
        .send({ title: "Task A", data: { [propId]: 1 } });
      await request(getApp())
        .post(`/api/databases/${dbId}/rows`)
        .send({ title: "Task B", data: { [propId]: 2 } });

      const res = await request(getApp())
        .get(`/api/databases/${dbId}/rows`)
        .query({ sortField: propId, sortDir: "desc" })
        .expect(200);

      expect(res.body[0].title).toBe("Task C");
    });
  });

  describe("combined filter and sort", () => {
    it("filters and sorts rows together", async () => {
      const statusPropId = "status-prop";
      const priorityPropId = "priority-prop";
      const dbId = await createPageAndDb("Tasks", [
        { id: statusPropId, name: "Status", type: "select" },
        { id: priorityPropId, name: "Priority", type: "number" },
      ]);

      await request(getApp())
        .post(`/api/databases/${dbId}/rows`)
        .send({ title: "Task C", data: { [statusPropId]: "Active", [priorityPropId]: 3 } });
      await request(getApp())
        .post(`/api/databases/${dbId}/rows`)
        .send({ title: "Task A", data: { [statusPropId]: "Active", [priorityPropId]: 1 } });
      await request(getApp())
        .post(`/api/databases/${dbId}/rows`)
        .send({ title: "Task D", data: { [statusPropId]: "Done", [priorityPropId]: 4 } });
      await request(getApp())
        .post(`/api/databases/${dbId}/rows`)
        .send({ title: "Task B", data: { [statusPropId]: "Active", [priorityPropId]: 2 } });

      const res = await request(getApp())
        .get(`/api/databases/${dbId}/rows`)
        .query({
          sortField: priorityPropId,
          sortDir: "asc",
          filter: JSON.stringify([{ field: statusPropId, operator: "is", value: "Active" }]),
        })
        .expect(200);

      expect(res.body).toHaveLength(3);
      expect(res.body[0].title).toBe("Task A");
      expect(res.body[1].title).toBe("Task B");
      expect(res.body[2].title).toBe("Task C");
    });

    it("combines multiple filters with AND", async () => {
      const statusPropId = "status-prop";
      const donePropId = "done-prop";
      const dbId = await createPageAndDb("Tasks", [
        { id: statusPropId, name: "Status", type: "select" },
        { id: donePropId, name: "Done", type: "checkbox" },
      ]);

      await request(getApp())
        .post(`/api/databases/${dbId}/rows`)
        .send({ title: "Task 1", data: { [statusPropId]: "Active", [donePropId]: false } });
      await request(getApp())
        .post(`/api/databases/${dbId}/rows`)
        .send({ title: "Task 2", data: { [statusPropId]: "Active", [donePropId]: true } });
      await request(getApp())
        .post(`/api/databases/${dbId}/rows`)
        .send({ title: "Task 3", data: { [statusPropId]: "Done", [donePropId]: false } });

      const res = await request(getApp())
        .get(`/api/databases/${dbId}/rows`)
        .query({
          filter: JSON.stringify([
            { field: statusPropId, operator: "is", value: "Active" },
            { field: donePropId, operator: "is", value: false },
          ]),
        })
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].title).toBe("Task 1");
    });
  });
});
