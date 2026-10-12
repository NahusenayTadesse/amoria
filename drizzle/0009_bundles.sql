CREATE TABLE `bundle` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(160) NOT NULL,
	`name` varchar(160) NOT NULL,
	`name_am` varchar(160),
	`description` text,
	`description_am` text,
	`discount_percent` decimal(5,2) NOT NULL DEFAULT 0,
	`category_id` int,
	`is_featured` boolean NOT NULL DEFAULT false,
	`published_at` datetime,
	`sort_order` int NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `bundle_id` PRIMARY KEY(`id`),
	CONSTRAINT `bundle_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `bundle_image` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bundle_id` int NOT NULL,
	`file_name` varchar(64) NOT NULL,
	`alt` varchar(160),
	`alt_am` varchar(160),
	`sort_order` int NOT NULL DEFAULT 0,
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `bundle_image_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bundle_item` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bundle_id` int NOT NULL,
	`product_id` int NOT NULL,
	`qty` int NOT NULL DEFAULT 1,
	`sort_order` int NOT NULL DEFAULT 0,
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `bundle_item_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `order_item` ADD `bundle_id` int;--> statement-breakpoint
ALTER TABLE `order_item` ADD `bundle_name` varchar(160);--> statement-breakpoint
ALTER TABLE `order_item` ADD `bundle_qty` int;--> statement-breakpoint
ALTER TABLE `bundle` ADD CONSTRAINT `bundle_category_id_category_id_fk` FOREIGN KEY (`category_id`) REFERENCES `category`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bundle` ADD CONSTRAINT `bundle_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bundle` ADD CONSTRAINT `bundle_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bundle` ADD CONSTRAINT `bundle_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bundle_image` ADD CONSTRAINT `bundle_image_bundle_id_bundle_id_fk` FOREIGN KEY (`bundle_id`) REFERENCES `bundle`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bundle_image` ADD CONSTRAINT `bundle_image_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bundle_item` ADD CONSTRAINT `bundle_item_bundle_id_bundle_id_fk` FOREIGN KEY (`bundle_id`) REFERENCES `bundle`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bundle_item` ADD CONSTRAINT `bundle_item_product_id_product_id_fk` FOREIGN KEY (`product_id`) REFERENCES `product`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bundle_item` ADD CONSTRAINT `bundle_item_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `bundle_published_idx` ON `bundle` (`published_at`);--> statement-breakpoint
CREATE INDEX `bundle_image_owner_idx` ON `bundle_image` (`bundle_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `bundle_item_owner_idx` ON `bundle_item` (`bundle_id`,`sort_order`);--> statement-breakpoint
ALTER TABLE `order_item` ADD CONSTRAINT `order_item_bundle_id_bundle_id_fk` FOREIGN KEY (`bundle_id`) REFERENCES `bundle`(`id`) ON DELETE restrict ON UPDATE no action;