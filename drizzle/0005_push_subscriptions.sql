CREATE TABLE `push_subscription` (
	`id` int AUTO_INCREMENT NOT NULL,
	`endpoint` varchar(500) NOT NULL,
	`p256dh` varchar(255) NOT NULL,
	`auth` varchar(64) NOT NULL,
	`locale` enum('en','am') NOT NULL DEFAULT 'en',
	`target_type` enum('order','registration') NOT NULL,
	`target_id` int NOT NULL,
	`reminded_at` datetime,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	CONSTRAINT `push_subscription_id` PRIMARY KEY(`id`),
	CONSTRAINT `push_subscription_endpoint_target_unique` UNIQUE(`endpoint`,`target_type`,`target_id`)
);
--> statement-breakpoint
CREATE INDEX `push_subscription_target_idx` ON `push_subscription` (`target_type`,`target_id`);