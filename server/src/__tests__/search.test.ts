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

describe("search routes (integration)", () => {
  beforeEach(async () => {
    const home = await request(getApp())
      .post("/api/pages")
      .send({ title: "Home", icon: "🏠" });

    const projects = await request(getApp())
      .post("/api/pages")
      .send({ title: "Projects", parentId: home.body.id, icon: "📋" });

    const tasksPage = await request(getApp())
      .post("/api/pages")
      .send({ title: "Task Tracker", parentId: projects.body.id, icon: "✅" });

    const dbRes = await request(getApp())
      .post("/api/databases")
      .send({ pageId: tasksPage.body.id, name: "Task Tracker" });

    await request(getApp())
      .post(`/api/databases/${dbRes.body.id}/rows`)
      .send({ title: "Design new onboarding flow" });

    await request(getApp())
      .post(`/api/databases/${dbRes.body.id}/rows`)
      .send({ title: "Set up CI/CD pipeline" });
  });

  it("finds pages by title", async () => {
    const res = await request(getApp())
      .get("/api/search")
      .query({ q: "Project" })
      .expect(200);

    expect(res.body.length).toBeGreaterThanOrEqual(1);
    const titles = res.body.map((r: any) => r.title);
    expect(titles).toContain("Projects");
  });

  it("finds rows by title", async () => {
    const res = await request(getApp())
      .get("/api/search")
      .query({ q: "onboarding" })
      .expect(200);

    expect(res.body.length).toBeGreaterThanOrEqual(1);
    const row = res.body.find((r: any) => r.type === "row");
    expect(row).toBeTruthy();
    expect(row.title).toBe("Design new onboarding flow");
  });

  it("returns empty for no matches", async () => {
    const res = await request(getApp())
      .get("/api/search")
      .query({ q: "zzzznonexistent" })
      .expect(200);

    expect(res.body).toHaveLength(0);
  });

  it("returns empty for empty query", async () => {
    const res = await request(getApp())
      .get("/api/search")
      .query({ q: "" })
      .expect(200);

    expect(res.body).toHaveLength(0);
  });

  it("scores exact matches higher than partial", async () => {
    const res = await request(getApp())
      .get("/api/search")
      .query({ q: "Task Tracker" })
      .expect(200);

    const exact = res.body.find((r: any) => r.title === "Task Tracker");
    expect(exact).toBeTruthy();
  });

  it("includes parent chain in results", async () => {
    const res = await request(getApp())
      .get("/api/search")
      .query({ q: "Home" })
      .expect(200);

    const home = res.body.find((r: any) => r.title === "Home");
    expect(home).toBeTruthy();
    expect(home.parentChain).toBeDefined();
  });
});
