CREATE TABLE `google_calendar_mapping` (
	`local_row_id` text PRIMARY KEY NOT NULL,
	`calendar_id` text NOT NULL,
	`remote_event_id` text NOT NULL,
	`remote_etag` text NOT NULL,
	`remote_updated` text NOT NULL,
	`local_fingerprint` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_google_calendar_mapping_remote_event` ON `google_calendar_mapping` (`calendar_id`,`remote_event_id`);--> statement-breakpoint
CREATE INDEX `idx_google_calendar_mapping_calendar` ON `google_calendar_mapping` (`calendar_id`);--> statement-breakpoint
CREATE TABLE `google_calendar_state` (
	`id` text PRIMARY KEY NOT NULL,
	`last_sync_at` text,
	`last_error` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
