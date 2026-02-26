PRAGMA foreign_keys=OFF;

DROP TABLE IF EXISTS `articles`;

CREATE TABLE `articles` (
    `feed_id` integer NOT NULL,
    `episode_key` text DEFAULT '' NOT NULL,
    `guid` text,
    `source_url` text NOT NULL,
    `title` text NOT NULL,
    `summary` text,
    `content` text,
    `audio_url` text,
    `audio_path` text,
    `status` text DEFAULT 'pending' NOT NULL,
    `error_message` text,
    `generation_mode` text,
    `content_source` text,
    `last_generation_attempt_at` text,
    `published_at` text,
    `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
    `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY (`feed_id`) REFERENCES `feeds`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE UNIQUE INDEX `articles_feed_source_unique` ON `articles` (`feed_id`,`source_url`);
CREATE UNIQUE INDEX `articles_feed_episode_key_unique` ON `articles` (`feed_id`,`episode_key`);

PRAGMA foreign_keys=ON;
