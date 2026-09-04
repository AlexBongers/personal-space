import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renders the Personal Space workspace shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>Personal Space — Your quiet knowledge manager<\/title>/i);
  assert.match(html, /Personal Space/);
  assert.match(html, /A calm place for busy minds/);
  assert.match(html, /Zoek in je ruimte/);
  assert.match(html, />EN<|>EN<\/button>/);
  assert.match(html, />NL<|>NL<\/button>/);
  assert.match(html, /role="separator"/);
  assert.match(html, /Zijbalk aanpassen/);
  assert.match(html, /og\.png/);
  assert.doesNotMatch(html, /Make room for|what matters\./i);
  assert.match(html, /Verbinden met D1/);
  assert.doesNotMatch(html, /Changes stored in this browser/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});
