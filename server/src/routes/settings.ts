import { Router, Request, Response } from "express";
import { getDb } from "../db";

const router = Router();

interface SettingRow {
  key: string;
  value: string;
}

router.get("/:key", (req: Request<{ key: string }>, res: Response) => {
  const db = getDb();
  const row = db.prepare("SELECT * FROM settings WHERE key = ?").get(req.params.key) as SettingRow | undefined;
  if (!row) {
    res.json({ value: null });
    return;
  }
  res.json({ value: row.value });
});

router.patch("/", (req: Request, res: Response) => {
  const db = getDb();
  const { key, value } = req.body;

  if (!key || typeof key !== "string") {
    res.status(400).json({ error: "Key is required" });
    return;
  }

  const existing = db.prepare("SELECT * FROM settings WHERE key = ?").get(key) as SettingRow | undefined;
  if (existing) {
    db.prepare("UPDATE settings SET value = ? WHERE key = ?").run(value ?? null, key);
  } else {
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run(key, value ?? null);
  }

  res.json({ key, value });
});

export default router;
