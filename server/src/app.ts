import express from "express";
import type Database from "better-sqlite3";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pagesRouter } from "./routes/pages.js";
import { blocksRouter } from "./routes/blocks.js";
import { databasesRouter } from "./routes/databases.js";
import { searchRouter } from "./routes/search.js";

const webDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../web/dist");

/** Build the Express app around an open database. */
export function createApp(db: Database.Database): express.Express {
  const app = express();
  app.use(express.json({ limit: "2mb" }));
  app.use("/api", pagesRouter(db));
  app.use("/api", blocksRouter(db));
  app.use("/api", databasesRouter(db));
  app.use("/api", searchRouter(db));

  if (existsSync(webDist)) {
    app.use(express.static(webDist));
    app.use((req, res, next) => {
      if (req.method === "GET" && !req.path.startsWith("/api")) {
        res.sendFile(path.join(webDist, "index.html"));
      } else {
        next();
      }
    });
  }
  return app;
}
