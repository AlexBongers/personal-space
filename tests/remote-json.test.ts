import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { fetchRemoteJson } from "../app/personal-space/remote-json.ts";

test("remote panels time out a stalled response body and can retry", async () => {
  let stall = true;
  const server = createServer((_request, response) => {
    response.setHeader("Content-Type", "application/json");
    if (stall) response.flushHeaders();
    else response.end(JSON.stringify({ stories: ["fresh"] }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const url = `http://127.0.0.1:${address.port}`;
  try {
    await assert.rejects(fetchRemoteJson(url, {}, 100));
    stall = false;
    const { body } = await fetchRemoteJson<{ stories: string[] }>(url);
    assert.deepEqual(body.stories, ["fresh"]);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("leaving a panel cancels its remote request", async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(fetchRemoteJson("http://127.0.0.1:1", { signal: controller.signal }), { name: "AbortError" });
});
