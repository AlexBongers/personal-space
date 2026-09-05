ALTER TABLE `parro_messages` ADD `attachment_count` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `parro_messages` ADD `attachment_names_json` text DEFAULT '[]' NOT NULL;