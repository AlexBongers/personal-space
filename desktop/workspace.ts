import type { Item } from "../app/personal-space/types.ts";
import { loadWorkspace, type WorkspaceDatabase } from "../worker/workspace-store.ts";
import type { D1Database } from "./d1-sqlite.ts";

/** The workspace store expects the D1 interface, which the SQLite adapter provides. */
export const asWorkspaceDatabase = (database: D1Database) => database as unknown as WorkspaceDatabase;

/** One cheap number that changes whenever anyone saves the workspace. */
export const readRevision = (database: D1Database) =>
  Number((database.sqlite.prepare("SELECT revision FROM workspace_state WHERE id = 'primary'").get() as { revision?: number } | undefined)?.revision ?? 0);

export const readItems = async (database: D1Database): Promise<Item[]> => (await loadWorkspace(asWorkspaceDatabase(database))).items;
