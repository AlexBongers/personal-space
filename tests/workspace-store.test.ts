import assert from "node:assert/strict";
import test from "node:test";
import { makeSeed } from "../app/personal-space/model.ts";
import {
  isWorkspaceItems,
  loadWorkspace,
  MAX_WORKSPACE_BYTES,
  saveWorkspace,
  type D1RunResult,
  type WorkspaceDatabase,
  type WorkspaceStatement,
} from "../worker/workspace-store.ts";

type StoredRow = { revision: number; data: string; updated_at: string };

class MemoryStatement implements WorkspaceStatement {
  private values: unknown[] = [];
  private query: string;
  private database: MemoryDatabase;

  constructor(query: string, database: MemoryDatabase) {
    this.query = query;
    this.database = database;
  }

  bind(...values: unknown[]) {
    this.values = values;
    return this;
  }

  async first<T>() {
    if (!this.query.startsWith("SELECT")) throw new Error("Unexpected first query");
    return (this.database.row ? { ...this.database.row } : null) as T | null;
  }

  async run(): Promise<D1RunResult> {
    if (this.query.startsWith("CREATE TABLE")) return { meta: { changes: 0 } };
    if (this.query.startsWith("INSERT OR IGNORE")) {
      if (!this.database.row) {
        this.database.row = { revision: 1, data: String(this.values[1]), updated_at: "2026-08-03 09:00:00" };
        return { meta: { changes: 1 } };
      }
      return { meta: { changes: 0 } };
    }
    if (this.query.startsWith("UPDATE")) {
      const [data, , expectedRevision] = this.values;
      if (!this.database.row || this.database.row.revision !== expectedRevision) return { meta: { changes: 0 } };
      this.database.row = {
        revision: this.database.row.revision + 1,
        data: String(data),
        updated_at: "2026-08-03 09:01:00",
      };
      return { meta: { changes: 1 } };
    }
    throw new Error(`Unexpected run query: ${this.query}`);
  }
}

class MemoryDatabase implements WorkspaceDatabase {
  row: StoredRow | null = null;

  prepare(query: string) {
    return new MemoryStatement(query, this);
  }
}

test("a new D1 database is initialized with the deterministic workspace", async () => {
  const database = new MemoryDatabase();
  const workspace = await loadWorkspace(database);

  assert.equal(workspace.revision, 1);
  assert.equal(workspace.items[0].id, "home");
  assert.equal(workspace.items.length, makeSeed().length);
  assert.ok(database.row);
});

test("saving uses optimistic revisions and returns the durable row", async () => {
  const database = new MemoryDatabase();
  const initial = await loadWorkspace(database);
  const renamed = initial.items.map((item) => item.id === "home" ? { ...item, title: "D1 home" } : item);
  const saved = await saveWorkspace(database, renamed, initial.revision);

  assert.equal(saved.ok, true);
  if (!saved.ok) return;
  assert.equal(saved.workspace.revision, 2);
  assert.equal(saved.workspace.items[0].title, "D1 home");
  assert.equal(saved.workspace.updatedAt, "2026-08-03 09:01:00");
});

test("stale revisions are rejected with the current workspace", async () => {
  const database = new MemoryDatabase();
  const initial = await loadWorkspace(database);
  await saveWorkspace(database, initial.items, initial.revision);
  const conflict = await saveWorkspace(database, initial.items, initial.revision);

  assert.equal(conflict.ok, false);
  if (conflict.ok) return;
  assert.equal(conflict.current.revision, 2);
});

test("workspace validation rejects malformed nested records", () => {
  const valid = makeSeed();
  assert.equal(isWorkspaceItems(valid), true);
  assert.equal(isWorkspaceItems({ items: valid }), false);
  assert.equal(isWorkspaceItems([{ ...valid[0], blocks: [{ id: "bad" }] }]), false);
  assert.equal(isWorkspaceItems([{ ...valid[0], parentId: 42 }]), false);
});

test("the storage boundary rejects oversized workspaces", async () => {
  const database = new MemoryDatabase();
  const initial = await loadWorkspace(database);
  const huge = initial.items.map((item) => item.id === "home" && item.kind === "page"
    ? { ...item, blocks: [{ id: "huge", type: "paragraph" as const, text: "x".repeat(MAX_WORKSPACE_BYTES) }] }
    : item);

  await assert.rejects(() => saveWorkspace(database, huge, initial.revision), RangeError);
});
