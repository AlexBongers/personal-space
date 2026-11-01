import assert from "node:assert/strict";
import test from "node:test";
import { isAuthorized, isLocalRequest, signedInUser } from "../worker/access.ts";

test("identifies the Access-signed-in owner from the email header", () => {
  const owner = new Request("https://personal.example/", { headers: { "Cf-Access-Authenticated-User-Email": "owner@example.com" } });
  assert.equal(signedInUser(owner), "owner@example.com");
  assert.equal(isAuthorized(owner), true);
});

test("rejects requests without an Access identity outside localhost", () => {
  const anonymous = new Request("https://personal.example/api/workspace");
  assert.equal(signedInUser(anonymous), "");
  assert.equal(isAuthorized(anonymous), false);
});

test("allows localhost development without an Access identity", () => {
  assert.equal(isLocalRequest(new Request("http://localhost:3000/")), true);
  assert.equal(isLocalRequest(new Request("http://127.0.0.1:3000/")), true);
  assert.equal(isAuthorized(new Request("http://localhost:3000/api/workspace")), true);
});

test("built worker refuses the private workspace to anonymous visitors", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const env = { ASSETS: { fetch: async () => new Response("asset", { status: 200 }) }, DB: undefined };
  const context = { waitUntil() {}, passThroughOnException() {} };

  const anonymous = await worker.fetch(new Request("https://personal.example/api/workspace"), env, context);
  assert.equal(anonymous.status, 403);
  assert.doesNotMatch(await anonymous.text(), /items|revision/i);

  const page = await worker.fetch(new Request("https://personal.example/", { headers: { accept: "text/html" } }), env, context);
  assert.equal(page.status, 403);
});
