import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { D1Database } from "../desktop/d1-sqlite.ts";
import { migrate } from "../desktop/migrate.ts";
import { startLocalServer } from "../desktop/server.ts";

let local;
let server;
let base;

before(async () => {
  const database = new D1Database(":memory:");
  migrate(database, "drizzle");
  local = await startLocalServer({ distDir: "dist", database, env: {}, port: 0 });
  server = local.server;
  base = `http://localhost:${server.address().port}`;
});

after(() => local.close());

test("serves the app shell", async () => {
  const response = await fetch(`${base}/`);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /<title>Personal Space/);
});

test("serves built client assets", async () => {
  assert.equal((await fetch(`${base}/favicon.svg`)).status, 200);
});

test("stores and returns the workspace", async () => {
  const workspace = await (await fetch(`${base}/api/workspace`)).json();
  assert.ok(workspace.items.length > 0);
  const saved = await fetch(`${base}/api/workspace`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items: workspace.items, baseRevision: workspace.revision }),
  });
  assert.equal(saved.status, 200);
  assert.equal((await saved.json()).revision, workspace.revision + 1);
});

test("rejects cross-origin writes", async () => {
  const response = await fetch(`${base}/api/workspace`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Origin: "https://evil.example" },
    body: "{}",
  });
  assert.equal(response.status, 403);
});

test("rejects a foreign Host header (DNS rebinding)", async () => {
  const { request } = await import("node:http");
  const status = await new Promise((resolve, reject) => {
    const req = request({ host: "127.0.0.1", port: server.address().port, path: "/api/workspace", headers: { Host: "evil.example" } }, (res) => { res.resume(); resolve(res.statusCode); });
    req.on("error", reject);
    req.end();
  });
  assert.equal(status, 403);
});

test("the app can call the Worker in process, without a socket", async () => {
  const response = await local.fetch("/api/workspace");
  assert.equal(response.status, 200);
  assert.ok((await response.json()).items.length > 0);
});

test("a port that is taken gives a clear message", async () => {
  const database = new D1Database(":memory:");
  await assert.rejects(startLocalServer({ distDir: "dist", database, env: {}, port: server.address().port }), /Poort \d+ is al in gebruik/);
});
