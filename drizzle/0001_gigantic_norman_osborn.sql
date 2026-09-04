CREATE TABLE `google_tasks_connection` (
	`id` text PRIMARY KEY NOT NULL,
	`refresh_token` text NOT NULL,
	`task_list_id` text,
	`task_list_title` text,
	`last_sync_at` text,
	`last_error` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `google_tasks_mapping` (
	`local_row_id` text PRIMARY KEY NOT NULL,
	`task_list_id` text NOT NULL,
	`remote_task_id` text NOT NULL,
	`remote_etag` text NOT NULL,
	`remote_updated` text NOT NULL,
	`local_fingerprint` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_google_tasks_mapping_remote_task` ON `google_tasks_mapping` (`task_list_id`,`remote_task_id`);--> statement-breakpoint
CREATE INDEX `idx_google_tasks_mapping_task_list` ON `google_tasks_mapping` (`task_list_id`);