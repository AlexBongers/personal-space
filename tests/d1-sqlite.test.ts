import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { backupDatabase } from "../desktop/backup.ts";
import { loadEnv } from "../desktop/config.ts";
import { D1Database } from "../desktop/d1-sqlite.ts";
import { migrate } from "../desktop/migrate.ts";
import { loadWorkspace, saveWorkspace } from "../worker/workspace-store.ts";

const migrated = () => {
  const database = new D1Database(":memory:");
  migrate(database, "drizzle");
  return database;
};

test("migrate creates every table and is idempotent", async () => {
  const database = migrated();
  migrate(database, "drizzle");
  const tables = (await database.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all<{ name: string }>()).results.map((row) => row.name);
  for (const name of ["workspace_state", "google_tasks_connection", "google_calendar_mapping", "google_sync_lease", "parro_messages"]) assert.ok(tables.includes(name), name);
  const applied = await database.prepare("SELECT COUNT(*) AS count FROM d1_migrations").first<{ count: number }>();
  assert.equal(applied?.count, JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")).entries.length);
});

test("first, all and run follow the D1 contract", async () => {
  const database = migrated();
  assert.equal(await database.prepare("SELECT * FROM google_sync_lease WHERE id = ?").bind("x").first(), null);
  const insert = database.prepare("INSERT INTO google_sync_lease (id, owner, expires_at) VALUES (?, ?, ?)");
  assert.equal((await insert.bind("a", "one", 10).run()).meta.changes, 1);
  const rows = await database.prepare("SELECT id FROM google_sync_lease").all<{ id: string }>();
  assert.deepEqual(rows.results.map((row) => row.id), ["a"]);
});

test("a lease that is still valid is not taken over", async () => {
  const database = migrated();
  await database.prepare("INSERT INTO google_sync_lease (id, owner, expires_at) VALUES (?, ?, ?)").bind("a", "one", 100).run();
  const take = database.prepare(`INSERT INTO google_sync_lease (id, owner, expires_at) VALUES (?, ?, ?)
ON CONFLICT(id) DO UPDATE SET owner = excluded.owner, expires_at = excluded.expires_at WHERE google_sync_lease.expires_at <= ?`);
  assert.equal((await take.bind("a", "two", 200, 50).run()).meta.changes, 0);
  assert.equal((await take.bind("a", "two", 200, 100).run()).meta.changes, 1);
});

test("batch rolls back everything when one statement fails", async () => {
  const database = migrated();
  const insert = (id: string) => database.prepare("INSERT INTO google_sync_lease (id, owner, expires_at) VALUES (?, ?, ?)").bind(id, "o", 1);
  await assert.rejects(database.batch([insert("a"), insert("b"), insert("a")]));
  const count = await database.prepare("SELECT COUNT(*) AS count FROM google_sync_lease").first<{ count: number }>();
  assert.equal(count?.count, 0);
});

test("the workspace store detects revision conflicts on SQLite", async () => {
  const database = migrated();
  const first = await loadWorkspace(database as never);
  const saved = await saveWorkspace(database as never, first.items, first.revision);
  assert.equal(saved.ok, true);
  const stale = await saveWorkspace(database as never, first.items, first.revision);
  assert.equal(stale.ok, false);
});

test("backups are written once per day and pruned to fourteen", () => {
  const dir = mkdtempSync(join(tmpdir(), "ps-backup-"));
  const database = migrated();
  assert.equal(backupDatabase(database, dir, new Date("2026-01-01T10:00:00Z")), true);
  assert.equal(backupDatabase(database, dir, new Date("2026-01-01T18:00:00Z")), false);
  for (let day = 2; day <= 20; day++) backupDatabase(database, dir, new Date(Date.UTC(2026, 0, day)));
  const files = readdirSync(join(dir, "backups")).sort();
  assert.equal(files.length, 14);
  assert.equal(files[0], "personal-space-2026-01-07.sqlite");
  assert.ok(statSync(join(dir, "backups", files[0])).size > 0);
});

test("config creates keys once, keeps them encrypted and reads config.json", () => {
  const dir = mkdtempSync(join(tmpdir(), "ps-config-"));
  const storage = { encryptString: (value: string) => Buffer.from(`enc:${value}`), decryptString: (value: Buffer) => value.toString().slice(4) };
  const first = loadEnv(dir, storage);
  const second = loadEnv(dir, storage);
  assert.equal(Buffer.from(first.GOOGLE_TOKEN_ENCRYPTION_KEY || "", "base64url").length, 32);
  assert.equal(first.GOOGLE_TOKEN_ENCRYPTION_KEY, second.GOOGLE_TOKEN_ENCRYPTION_KEY);
  assert.notEqual(first.GOOGLE_TOKEN_ENCRYPTION_KEY, first.PARRO_TOKEN_ENCRYPTION_KEY);
  assert.equal(first.GOOGLE_CLIENT_ID, undefined);
  assert.ok(readFileSync(join(dir, "keys.bin"), "utf8").startsWith("enc:"));
  assert.ok(existsSync(join(dir, "config.json")));
});
