CREATE TABLE `tts_provider_settings` (
	`provider_type` text PRIMARY KEY NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`api_key` text DEFAULT '' NOT NULL,
	`base_url` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tts_voices` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_type` text NOT NULL,
	`provider_voice_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`gender` text NOT NULL,
	`source` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
