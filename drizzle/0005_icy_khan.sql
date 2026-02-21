CREATE TABLE `__new_tts_voices` (
    `id` text PRIMARY KEY NOT NULL,
    `provider` text NOT NULL,
    `provider_voice_id` text NOT NULL,
    `name` text NOT NULL,
    `description` text,
    `gender` text NOT NULL,
    `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);

--> statement-breakpoint
INSERT INTO
    `__new_tts_voices` (
        `id`,
        `provider`,
        `provider_voice_id`,
        `name`,
        `description`,
        `gender`,
        `updated_at`
    )
SELECT
    `id`,
    `provider_type`,
    `provider_voice_id`,
    `name`,
    `description`,
    `gender`,
    `updated_at`
FROM
    `tts_voices`;

--> statement-breakpoint
DROP TABLE `tts_voices`;

--> statement-breakpoint
ALTER TABLE
    `__new_tts_voices` RENAME TO `tts_voices`;