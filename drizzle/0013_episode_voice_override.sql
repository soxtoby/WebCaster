ALTER TABLE `articles` ADD COLUMN `voice` text REFERENCES `tts_voices`(`id`);
