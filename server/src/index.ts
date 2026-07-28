import express from "express";
import cors from "cors";
import path from "path";
import { initDb } from "./db";
import { seed } from "./seed";
import pagesRouter from "./routes/pages";
import blocksRouter from "./routes/blocks";
import databasesRouter from "./routes/databases";
import viewsRouter from "./routes/views";
import searchRouter from "./routes/search";
import settingsRouter from "./routes/settings";

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 8300;

app.use(cors());
app.use(express.json());

initDb();
seed();

app.use("/api/pages", pagesRouter);
app.use("/api/databases", databasesRouter);
app.use("/api", viewsRouter);
app.use(blocksRouter);
app.use("/api/search", searchRouter);
app.use("/api/settings", settingsRouter);

app.get("/api/health", (_req, res) => {
  res.json({ message: "Hello from Personal Space" });
});

const isProduction = process.env.NODE_ENV === "production";

if (isProduction) {
  const distPath = path.join(__dirname, "../../client/dist");
  app.use(express.static(distPath));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`Personal Space server running on http://localhost:${PORT}`);
});

export default app;
