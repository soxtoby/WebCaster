ALTER TABLE `feeds` ADD `show_archived_episodes` integer DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE `articles` ADD `archived` integer DEFAULT false NOT NULL;