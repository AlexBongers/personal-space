CREATE TABLE `google_sync_creates` (
	`operation_key` text PRIMARY KEY NOT NULL,
	`service` text NOT NULL,
	`local_row_id` text NOT NULL,
	`container_id` text NOT NULL,
	`replaces_id` text DEFAULT '' NOT NULL,
	`payload_json` text NOT NULL,
	`observed_ids_json` text DEFAULT '[]' NOT NULL,
	`result_json` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_google_sync_creates_service` ON `google_sync_creates` (`service`);--> statement-breakpoint
CREATE TABLE `google_sync_lease` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`expires_at` integer NOT NULL
);
