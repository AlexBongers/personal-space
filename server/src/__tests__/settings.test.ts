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

describe("settings routes (integration)", () => {
  it("returns null for missing setting", async () => {
    const res = await request(getApp())
      .get("/api/settings/theme")
      .expect(200);

    expect(res.body.value).toBeNull();
  });

  it("inserts a new setting", async () => {
    await request(getApp())
      .patch("/api/settings")
      .send({ key: "theme", value: "dark" })
      .expect(200);

    const res = await request(getApp())
      .get("/api/settings/theme")
      .expect(200);

    expect(res.body.value).toBe("dark");
  });

  it("updates an existing setting", async () => {
    await request(getApp())
      .patch("/api/settings")
      .send({ key: "theme", value: "dark" })
      .expect(200);

    await request(getApp())
      .patch("/api/settings")
      .send({ key: "theme", value: "light" })
      .expect(200);

    const res = await request(getApp())
      .get("/api/settings/theme")
      .expect(200);

    expect(res.body.value).toBe("light");
  });

  it("rejects missing key", async () => {
    await request(getApp())
      .patch("/api/settings")
      .send({ value: "dark" })
      .expect(400);
  });

  it("stores and retrieves multiple settings", async () => {
    await request(getApp())
      .patch("/api/settings")
      .send({ key: "theme", value: "dark" });
    await request(getApp())
      .patch("/api/settings")
      .send({ key: "font_size", value: "14" });

    const theme = await request(getApp())
      .get("/api/settings/theme")
      .expect(200);
    expect(theme.body.value).toBe("dark");

    const font = await request(getApp())
      .get("/api/settings/font_size")
      .expect(200);
    expect(font.body.value).toBe("14");
  });
});
