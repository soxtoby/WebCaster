PRAGMA foreign_keys=OFF;

CREATE TABLE `__new_feeds` (
    `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    `name` text NOT NULL,
    `rss_url` text NOT NULL,
    `description` text,
    `image_url` text,
    `voice` text NOT NULL,
    `generation_mode` text DEFAULT 'on_demand' NOT NULL,
    `content_source` text DEFAULT 'feed_article' NOT NULL,
    `podcast_slug` text NOT NULL,
    `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
    `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY (`voice`) REFERENCES `tts_voices`(`id`) ON UPDATE no action ON DELETE no action
);

INSERT INTO `__new_feeds` (
    `id`,
    `name`,
    `rss_url`,
    `description`,
    `image_url`,
    `voice`,
    `generation_mode`,
    `content_source`,
    `podcast_slug`,
    `created_at`,
    `updated_at`
)
SELECT
    `id`,
    `name`,
    `rss_url`,
    `description`,
    `image_url`,
    `voice`,
    `generation_mode`,
    `content_source`,
    `podcast_slug`,
    `created_at`,
    `updated_at`
FROM `feeds`;

DROP TABLE `feeds`;
ALTER TABLE `__new_feeds` RENAME TO `feeds`;
CREATE UNIQUE INDEX `feeds_podcast_slug_unique` ON `feeds` (`podcast_slug`);

PRAGMA foreign_keys=ON;
