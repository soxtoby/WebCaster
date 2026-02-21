CREATE TABLE `__new_feeds` (
    `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    `name` text NOT NULL,
    `rss_url` text NOT NULL,
    `description` text,
    `image_url` text,
    `voice` text NOT NULL,
    `language` text NOT NULL,
    `generation_mode` text DEFAULT 'on_demand' NOT NULL,
    `content_source` text DEFAULT 'feed_article' NOT NULL,
    `podcast_slug` text NOT NULL,
    `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
    `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY (`voice`) REFERENCES `tts_voices`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_feeds` (
    `id`,
    `name`,
    `rss_url`,
    `description`,
    `image_url`,
    `voice`,
    `language`,
    `generation_mode`,
    `content_source`,
    `podcast_slug`,
    `created_at`,
    `updated_at`
)
SELECT
    f.`id`,
    f.`name`,
    f.`rss_url`,
    f.`description`,
    f.`image_url`,
    f.`voice`,
    f.`language`,
    f.`generation_mode`,
    f.`content_source`,
    f.`podcast_slug`,
    f.`created_at`,
    f.`updated_at`
FROM `feeds` f
--> statement-breakpoint
DROP TABLE `feeds`;
--> statement-breakpoint
ALTER TABLE `__new_feeds` RENAME TO `feeds`;
--> statement-breakpoint
CREATE UNIQUE INDEX `feeds_podcast_slug_unique` ON `feeds` (`podcast_slug`);