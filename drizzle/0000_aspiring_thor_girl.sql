CREATE TABLE `albums` (
	`id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`published` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `media` (
	`id` text PRIMARY KEY NOT NULL,
	`album_id` text NOT NULL,
	`key` text NOT NULL,
	`kind` text NOT NULL,
	`mime` text NOT NULL,
	`caption` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`album_id`) REFERENCES `albums`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_media_album_created` ON `media` (`album_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `operators` (
	`slot` integer PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`email` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `operators_user_id_unique` ON `operators` (`user_id`);