CREATE TABLE `parro_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`sender` text DEFAULT '' NOT NULL,
	`room_name` text DEFAULT '' NOT NULL,
	`published_at` text NOT NULL,
	`unread` integer DEFAULT 0 NOT NULL,
	`unread_count` integer DEFAULT 0 NOT NULL,
	`external_url` text DEFAULT '' NOT NULL,
	`synced_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_parro_messages_published_at` ON `parro_messages` (`published_at`);