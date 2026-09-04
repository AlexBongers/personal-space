import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const workspaceState = sqliteTable("workspace_state", {
  id: text("id").primaryKey(),
  revision: integer("revision").notNull().default(1),
  data: text("data").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const googleTasksConnection = sqliteTable("google_tasks_connection", {
  id: text("id").primaryKey(),
  refreshToken: text("refresh_token").notNull(),
  taskListId: text("task_list_id"),
  taskListTitle: text("task_list_title"),
  lastSyncAt: text("last_sync_at"),
  lastError: text("last_error"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const googleTasksMapping = sqliteTable("google_tasks_mapping", {
  localRowId: text("local_row_id").primaryKey(),
  taskListId: text("task_list_id").notNull(),
  remoteTaskId: text("remote_task_id").notNull(),
  remoteEtag: text("remote_etag").notNull(),
  remoteUpdated: text("remote_updated").notNull(),
  localFingerprint: text("local_fingerprint").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  remoteTask: uniqueIndex("uq_google_tasks_mapping_remote_task").on(table.taskListId, table.remoteTaskId),
  taskList: index("idx_google_tasks_mapping_task_list").on(table.taskListId),
}));
