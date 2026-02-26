ALTER TABLE `articles` ADD COLUMN `episode_key` text DEFAULT '' NOT NULL;
CREATE INDEX `articles_feed_episode_key_idx` ON `articles` (`feed_id`,`episode_key`);
