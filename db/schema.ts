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

export const googleCalendarState = sqliteTable("google_calendar_state", {
  id: text("id").primaryKey(),
  lastSyncAt: text("last_sync_at"),
  lastError: text("last_error"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const googleCalendarMapping = sqliteTable("google_calendar_mapping", {
  localRowId: text("local_row_id").primaryKey(),
  calendarId: text("calendar_id").notNull(),
  remoteEventId: text("remote_event_id").notNull(),
  remoteEtag: text("remote_etag").notNull(),
  remoteUpdated: text("remote_updated").notNull(),
  localFingerprint: text("local_fingerprint").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  remoteEvent: uniqueIndex("uq_google_calendar_mapping_remote_event").on(table.calendarId, table.remoteEventId),
  calendar: index("idx_google_calendar_mapping_calendar").on(table.calendarId),
}));

export const googleSyncLease = sqliteTable("google_sync_lease", {
  id: text("id").primaryKey(),
  owner: text("owner").notNull(),
  expiresAt: integer("expires_at").notNull(),
});

// Keep acknowledged and uncertain creations across Worker restarts and retries.
export const googleSyncCreates = sqliteTable("google_sync_creates", {
  operationKey: text("operation_key").primaryKey(),
  service: text("service").notNull(),
  localRowId: text("local_row_id").notNull(),
  containerId: text("container_id").notNull(),
  replacesId: text("replaces_id").notNull().default(""),
  payloadJson: text("payload_json").notNull(),
  observedIdsJson: text("observed_ids_json").notNull().default("[]"),
  resultJson: text("result_json"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({ service: index("idx_google_sync_creates_service").on(table.service) }));

export const parroMessage = sqliteTable("parro_messages", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  sender: text("sender").notNull().default(""),
  roomName: text("room_name").notNull().default(""),
  publishedAt: text("published_at").notNull(),
  unread: integer("unread").notNull().default(0),
  unreadCount: integer("unread_count").notNull().default(0),
  externalUrl: text("external_url").notNull().default(""),
  syncedAt: text("synced_at").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  published: index("idx_parro_messages_published_at").on(table.publishedAt),
}));
