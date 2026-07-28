import { describe, it, expect, vi, beforeEach } from "vitest";
import * as api from "../api";

describe("api", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("getPages calls /api/pages", async () => {
    const mock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ id: "1", title: "Home" }]),
    });
    globalThis.fetch = mock;

    const pages = await api.getPages();
    expect(pages).toEqual([{ id: "1", title: "Home" }]);
    expect(mock).toHaveBeenCalledWith("/api/pages", expect.any(Object));
  });

  it("getPage calls /api/pages/:id", async () => {
    const mock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: "1", title: "Home" }),
    });
    globalThis.fetch = mock;

    const page = await api.getPage("1");
    expect(page.title).toBe("Home");
    expect(mock).toHaveBeenCalledWith("/api/pages/1", expect.any(Object));
  });

  it("createPage POSTs to /api/pages", async () => {
    const mock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve({ id: "2", title: "New" }),
    });
    globalThis.fetch = mock;

    const page = await api.createPage({ title: "New", icon: "📄" });
    expect(page.title).toBe("New");
    expect(mock).toHaveBeenCalledWith("/api/pages", expect.objectContaining({ method: "POST" }));
  });

  it("updatePage PATCHes to /api/pages/:id", async () => {
    const mock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: "1", title: "Updated" }),
    });
    globalThis.fetch = mock;

    const page = await api.updatePage("1", { title: "Updated" });
    expect(page.title).toBe("Updated");
    expect(mock).toHaveBeenCalledWith("/api/pages/1", expect.objectContaining({ method: "PATCH" }));
  });

  it("deletePage DELETEs /api/pages/:id", async () => {
    const mock = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      json: () => Promise.resolve(null),
    });
    globalThis.fetch = mock;

    const result = await api.deletePage("1");
    expect(result).toBeUndefined();
    expect(mock).toHaveBeenCalledWith("/api/pages/1", expect.objectContaining({ method: "DELETE" }));
  });

  it("getBlocks fetches blocks for a page", async () => {
    const mock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ id: "b1", type: "paragraph" }]),
    });
    globalThis.fetch = mock;

    const blocks = await api.getBlocks("p1");
    expect(blocks).toHaveLength(1);
    expect(mock).toHaveBeenCalledWith("/api/pages/p1/blocks", expect.any(Object));
  });

  it("createBlock POSTs a block", async () => {
    const mock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve({ id: "b1", type: "paragraph", content: "Hi" }),
    });
    globalThis.fetch = mock;

    const block = await api.createBlock("p1", { type: "paragraph", content: "Hi" });
    expect(block.content).toBe("Hi");
    expect(mock).toHaveBeenCalledWith("/api/pages/p1/blocks", expect.objectContaining({ method: "POST" }));
  });

  it("updateBlock PATCHes a block", async () => {
    const mock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: "b1", content: "Updated" }),
    });
    globalThis.fetch = mock;

    const block = await api.updateBlock("b1", { content: "Updated" });
    expect(block.content).toBe("Updated");
    expect(mock).toHaveBeenCalledWith("/api/blocks/b1", expect.objectContaining({ method: "PATCH" }));
  });

  it("deleteBlock DELETEs a block", async () => {
    const mock = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      json: () => Promise.resolve(null),
    });
    globalThis.fetch = mock;

    await api.deleteBlock("b1");
    expect(mock).toHaveBeenCalledWith("/api/blocks/b1", expect.objectContaining({ method: "DELETE" }));
  });

  it("reorderBlocks PATCHes reorder", async () => {
    const mock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });
    globalThis.fetch = mock;

    await api.reorderBlocks([{ id: "b1", position: 0 }]);
    expect(mock).toHaveBeenCalledWith("/api/blocks/reorder", expect.objectContaining({ method: "PATCH" }));
  });

  it("getDatabaseByPage fetches database by page ID", async () => {
    const mock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: "db1", name: "Tasks" }),
    });
    globalThis.fetch = mock;

    const db = await api.getDatabaseByPage("p1");
    expect(db.name).toBe("Tasks");
  });

  it("getDatabase fetches database by DB id", async () => {
    const mock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: "db1", name: "Tasks" }),
    });
    globalThis.fetch = mock;

    const db = await api.getDatabase("db1");
    expect(db.name).toBe("Tasks");
  });

  it("createDatabase POSTs a database", async () => {
    const mock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve({ id: "db1", name: "Tasks" }),
    });
    globalThis.fetch = mock;

    const db = await api.createDatabase({ pageId: "p1", name: "Tasks" });
    expect(db.name).toBe("Tasks");
  });

  it("updateDatabase PATCHes database name", async () => {
    const mock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: "db1", name: "Updated" }),
    });
    globalThis.fetch = mock;

    const db = await api.updateDatabase("db1", { name: "Updated" });
    expect(db.name).toBe("Updated");
  });

  it("getRows fetches rows", async () => {
    const mock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ id: "r1", title: "Task 1" }]),
    });
    globalThis.fetch = mock;

    const rows = await api.getRows("db1");
    expect(rows).toHaveLength(1);
  });

  it("createRow POSTs a row", async () => {
    const mock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve({ id: "r1", title: "New Row" }),
    });
    globalThis.fetch = mock;

    const row = await api.createRow("db1", { title: "New Row" });
    expect(row.title).toBe("New Row");
  });

  it("updateRow PATCHes a row", async () => {
    const mock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: "r1", title: "Updated Row" }),
    });
    globalThis.fetch = mock;

    const row = await api.updateRow("r1", { title: "Updated Row" });
    expect(row.title).toBe("Updated Row");
  });

  it("deleteRow DELETEs a row", async () => {
    const mock = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      json: () => Promise.resolve(null),
    });
    globalThis.fetch = mock;

    await api.deleteRow("r1");
    expect(mock).toHaveBeenCalledWith("/api/databases/rows/r1", expect.objectContaining({ method: "DELETE" }));
  });

  it("updateProperties PATCHes database properties", async () => {
    const mock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: "db1", properties: [] }),
    });
    globalThis.fetch = mock;

    await api.updateProperties("db1", []);
    expect(mock).toHaveBeenCalledWith("/api/databases/db1/properties", expect.objectContaining({ method: "PATCH" }));
  });

  it("addSelectOption POSTs select option", async () => {
    const mock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve({ id: "opt1", value: "Backlog", color: "gray" }),
    });
    globalThis.fetch = mock;

    const opt = await api.addSelectOption("db1", "prop1", "Backlog", "gray");
    expect(opt.value).toBe("Backlog");
  });

  it("updateSelectOption PATCHes select option", async () => {
    const mock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: "opt1", value: "Done", color: "green" }),
    });
    globalThis.fetch = mock;

    const opt = await api.updateSelectOption("opt1", "Done", "green");
    expect(opt.color).toBe("green");
  });

  it("deleteSelectOption DELETEs select option", async () => {
    const mock = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      json: () => Promise.resolve(null),
    });
    globalThis.fetch = mock;

    await api.deleteSelectOption("opt1");
    expect(mock).toHaveBeenCalledWith("/api/databases/select-options/opt1", expect.objectContaining({ method: "DELETE" }));
  });

  it("getViews fetches views for a database", async () => {
    const mock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ id: "v1", type: "table" }]),
    });
    globalThis.fetch = mock;

    const views = await api.getViews("db1");
    expect(views).toHaveLength(1);
  });

  it("updateView PATCHes a view", async () => {
    const mock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: "v1", name: "Updated" }),
    });
    globalThis.fetch = mock;

    const view = await api.updateView("v1", { name: "Updated" });
    expect(view.name).toBe("Updated");
  });

  it("search performs a search", async () => {
    const mock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ id: "1", title: "Home", type: "page" }]),
    });
    globalThis.fetch = mock;

    const results = await api.search("Home");
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("Home");
  });

  it("getSetting fetches a setting", async () => {
    const mock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ value: "dark" }),
    });
    globalThis.fetch = mock;

    const result = await api.getSetting("theme");
    expect(result.value).toBe("dark");
  });

  it("updateSetting patches a setting", async () => {
    const mock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ key: "theme", value: "light" }),
    });
    globalThis.fetch = mock;

    const result = await api.updateSetting("theme", "light");
    expect(result.value).toBe("light");
  });

  it("getRowByRowId fetches a row by row ID", async () => {
    const mock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: "r1", pageId: "p1" }),
    });
    globalThis.fetch = mock;

    const row = await api.getRowByRowId("r1");
    expect(row.pageId).toBe("p1");
  });

  it("handles error responses", async () => {
    const mock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: "Not found" }),
    });
    globalThis.fetch = mock;

    await expect(api.getPage("bad")).rejects.toThrow("Not found");
  });

  it("handles non-json error responses", async () => {
    const mock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: () => Promise.reject(new Error("not json")),
    });
    globalThis.fetch = mock;

    await expect(api.getPage("bad")).rejects.toThrow("Internal Server Error");
  });
});
