import express from "express";
import { initDb } from "../../db";
import pagesRouter from "../../routes/pages";
import blocksRouter from "../../routes/blocks";
import databasesRouter from "../../routes/databases";
import viewsRouter from "../../routes/views";
import searchRouter from "../../routes/search";
import settingsRouter from "../../routes/settings";

export function createTestApp() {
  initDb(":memory:");
  const app = express();
  app.use(express.json());
  app.use("/api/pages", pagesRouter);
  app.use("/api/databases", databasesRouter);
  app.use("/api", viewsRouter);
  app.use(blocksRouter);
  app.use("/api/search", searchRouter);
  app.use("/api/settings", settingsRouter);
  return app;
}
