CREATE TABLE `rental_space` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(160) NOT NULL,
	`name` varchar(160) NOT NULL,
	`name_am` varchar(160),
	`summary` text,
	`summary_am` text,
	`description` text,
	`description_am` text,
	`features` longtext,
	`features_am` longtext,
	`capacity` int,
	`size_text` varchar(80),
	`price` decimal(12,2),
	`price_unit` varchar(40),
	`price_unit_am` varchar(40),
	`youtube_url` varchar(255),
	`sort_order` int NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `rental_space_id` PRIMARY KEY(`id`),
	CONSTRAINT `rental_space_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `rental_space_image` (
	`id` int AUTO_INCREMENT NOT NULL,
	`space_id` int NOT NULL,
	`file_name` varchar(64) NOT NULL,
	`alt` varchar(160),
	`alt_am` varchar(160),
	`sort_order` int NOT NULL DEFAULT 0,
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `rental_space_image_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `rental_space` ADD CONSTRAINT `rental_space_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `rental_space` ADD CONSTRAINT `rental_space_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `rental_space` ADD CONSTRAINT `rental_space_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `rental_space_image` ADD CONSTRAINT `rental_space_image_space_id_rental_space_id_fk` FOREIGN KEY (`space_id`) REFERENCES `rental_space`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `rental_space_image` ADD CONSTRAINT `rental_space_image_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `rental_space_image_owner_idx` ON `rental_space_image` (`space_id`,`sort_order`);