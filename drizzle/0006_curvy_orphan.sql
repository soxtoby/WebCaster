ALTER TABLE `feeds` ADD `generation_mode` text DEFAULT 'on_demand' NOT NULL;
--> statement-breakpoint
ALTER TABLE `feeds` ADD `content_source` text DEFAULT 'feed_article' NOT NULL;
--> statement-breakpoint
ALTER TABLE `feeds` ADD `podcast_slug` text;
--> statement-breakpoint
UPDATE `feeds` SET `podcast_slug` = lower(hex(randomblob(8))) WHERE `podcast_slug` IS NULL OR trim(`podcast_slug`) = '';
--> statement-breakpoint
CREATE UNIQUE INDEX `feeds_podcast_slug_unique` ON `feeds` (`podcast_slug`);
--> statement-breakpoint
ALTER TABLE `articles` ADD `content` text;
--> statement-breakpoint
ALTER TABLE `articles` ADD `audio_path` text;
--> statement-breakpoint
ALTER TABLE `articles` ADD `error_message` text;
--> statement-breakpoint
ALTER TABLE `articles` ADD `generation_mode` text;
--> statement-breakpoint
ALTER TABLE `articles` ADD `content_source` text;
--> statement-breakpoint
ALTER TABLE `articles` ADD `last_generation_attempt_at` text;
--> statement-breakpoint
CREATE UNIQUE INDEX `articles_feed_source_unique` ON `articles` (`feed_id`,`source_url`);