CREATE TABLE `delivery_area` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`name_am` varchar(100),
	`fee` decimal(12,2) NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	`status` boolean NOT NULL DEFAULT true,
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `delivery_area_id` PRIMARY KEY(`id`),
	CONSTRAINT `delivery_area_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
ALTER TABLE `orders` ADD `delivery_area_id` int;--> statement-breakpoint
ALTER TABLE `orders` ADD `delivery_area_name` varchar(100);--> statement-breakpoint
ALTER TABLE `delivery_area` ADD CONSTRAINT `delivery_area_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_delivery_area_id_delivery_area_id_fk` FOREIGN KEY (`delivery_area_id`) REFERENCES `delivery_area`(`id`) ON DELETE restrict ON UPDATE no action;