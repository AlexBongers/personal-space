import { createServer, type Server } from "node:http";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { getRequestListener } from "@hono/node-server";
import sirv from "sirv";
import type { D1Database } from "./d1-sqlite.ts";

export type LocalEnv = {
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_TOKEN_ENCRYPTION_KEY?: string;
  PARRO_TOKEN_ENCRYPTION_KEY?: string;
  GOOGLE_CALENDAR_SYNC_ONLY?: string;
};

type Worker = { fetch(request: Request, env: unknown, ctx: unknown): Promise<Response> };

export type LocalServerOptions = {
  /** Folder that holds the production build: `server/index.js` and `client/`. */
  distDir: string;
  database: D1Database;
  env: LocalEnv;
  port: number;
};

/** Serves the built client assets first, then hands everything else to the Worker, like Cloudflare does. */
export const startLocalServer = async ({ distDir, database, env, port }: LocalServerOptions): Promise<Server> => {
  const { default: worker } = await import(pathToFileURL(resolve(distDir, "server", "index.js")).href) as { default: Worker };
  const serveAsset = sirv(join(distDir, "client"), { etag: true, dev: false });
  const pending = new Set<Promise<unknown>>();
  const context = {
    waitUntil: (promise: Promise<unknown>) => { pending.add(promise); promise.finally(() => pending.delete(promise)).catch(() => {}); },
    passThroughOnException: () => {},
  };
  const workerEnv = { ...env, DB: database, ASSETS: { fetch: (request: Request) => worker.fetch(request, workerEnv, context) } };

  const handleWorker = getRequestListener((request) => worker.fetch(request, workerEnv, context));
  const server = createServer((request, response) => {
    // Only the Worker enforces the host check, so assets are served after it has accepted the request.
    if (request.method === "GET" && request.url && !request.url.startsWith("/api/") && isLocalHost(request.headers.host)) {
      serveAsset(request, response, () => handleWorker(request, response));
      return;
    }
    handleWorker(request, response);
  });
  server.on("close", () => { void Promise.allSettled(pending); });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  return server;
};

const isLocalHost = (host = "") => /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
