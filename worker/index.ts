/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { handleGoogleTasksApi } from "./google-tasks";
import { handleGoogleCalendarApi } from "./google-calendar";
import { handleSlashdotApi } from "./slashdot";
import { handleNewsApi } from "./news";
import { handleGmailApi } from "./gmail";
import { handleParroApi } from "./parro";
import { isWorkspaceItems, loadWorkspace, MAX_WORKSPACE_BYTES, saveWorkspace } from "./workspace-store";
import type { GoogleTasksDatabase } from "./google-tasks";
import type { ParroDatabase } from "./parro";
import type { WorkspaceDatabase } from "./workspace-store";

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  DB?: GoogleTasksDatabase;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_REDIRECT_URI?: string;
  GOOGLE_TOKEN_ENCRYPTION_KEY?: string;
  PARRO_SYNC_TOKEN?: string;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
  },
});

const handleWorkspaceApi = async (request: Request, env: Env, url: URL) => {
  if (!env.DB) return json({ error: "D1 database is not configured" }, 503);
  const database = env.DB as unknown as WorkspaceDatabase;

  if (request.method === "GET") {
    return json(await loadWorkspace(database));
  }

  if (request.method !== "PUT") {
    return new Response(null, { status: 405, headers: { Allow: "GET, PUT" } });
  }

  const origin = request.headers.get("Origin");
  if (origin && origin !== url.origin) return json({ error: "Cross-origin writes are not allowed" }, 403);
  if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) {
    return json({ error: "Expected an application/json request" }, 415);
  }

  const declaredLength = Number(request.headers.get("Content-Length") || 0);
  if (declaredLength > MAX_WORKSPACE_BYTES) return json({ error: "Workspace exceeds the storage limit" }, 413);

  const body = await request.json().catch(() => null) as { items?: unknown; baseRevision?: unknown } | null;
  if (!body || !isWorkspaceItems(body.items) || !Number.isInteger(body.baseRevision) || Number(body.baseRevision) < 1) {
    return json({ error: "Invalid workspace payload" }, 400);
  }

  try {
    const result = await saveWorkspace(database, body.items, Number(body.baseRevision));
    if (!result.ok) return json({ error: "Workspace changed in another tab", ...result.current }, 409);
    return json(result.workspace);
  } catch (error) {
    if (error instanceof RangeError) return json({ error: error.message }, 413);
    throw error;
  }
};

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    if (url.pathname === "/api/workspace") {
      try {
        return await handleWorkspaceApi(request, env, url);
      } catch (error) {
        console.error("Workspace API failed", error);
        return json({ error: "Workspace storage is temporarily unavailable" }, 500);
      }
    }

    if (url.pathname === "/api/slashdot") {
      return handleSlashdotApi(request);
    }
    if (url.pathname === "/api/tweakers") return handleNewsApi(request, "tweakers");
    if (url.pathname === "/api/gmail/inbox") return handleGmailApi(request, {
      DB: env.DB as unknown as GoogleTasksDatabase | undefined,
      GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET,
      GOOGLE_REDIRECT_URI: env.GOOGLE_REDIRECT_URI,
      GOOGLE_TOKEN_ENCRYPTION_KEY: env.GOOGLE_TOKEN_ENCRYPTION_KEY,
    });

    if (url.pathname.startsWith("/api/parro/")) {
      try {
        return await handleParroApi(request, {
          DB: env.DB as unknown as ParroDatabase | undefined,
          PARRO_SYNC_TOKEN: env.PARRO_SYNC_TOKEN,
        }, url) || new Response(null, { status: 404 });
      } catch (error) {
        console.error("Parro API failed", error);
        return json({ error: "Parro is temporarily unavailable" }, 500);
      }
    }

    if (url.pathname.startsWith("/api/google-tasks/")) {
      try {
        return await handleGoogleTasksApi(request, {
          DB: env.DB as unknown as GoogleTasksDatabase | undefined,
          GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID,
          GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET,
          GOOGLE_REDIRECT_URI: env.GOOGLE_REDIRECT_URI,
          GOOGLE_TOKEN_ENCRYPTION_KEY: env.GOOGLE_TOKEN_ENCRYPTION_KEY,
        }, url) || new Response(null, { status: 404 });
      } catch (error) {
        console.error("Google Tasks API failed", error);
        return json({ error: "Google Tasks is temporarily unavailable" }, 500);
      }
    }

    if (url.pathname.startsWith("/api/google-calendar/")) {
      try {
        return await handleGoogleCalendarApi(request, {
          DB: env.DB as unknown as GoogleTasksDatabase | undefined,
          GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID,
          GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET,
          GOOGLE_REDIRECT_URI: env.GOOGLE_REDIRECT_URI,
          GOOGLE_TOKEN_ENCRYPTION_KEY: env.GOOGLE_TOKEN_ENCRYPTION_KEY,
        }, url) || new Response(null, { status: 404 });
      } catch (error) {
        console.error("Google Calendar API failed", error);
        return json({ error: "Google Calendar is temporarily unavailable" }, 500);
      }
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
