CREATE TABLE `container_rule` (
	`id` int AUTO_INCREMENT NOT NULL,
	`container_id` int NOT NULL,
	`category_id` int,
	`product_id` int,
	`min_qty` int NOT NULL DEFAULT 0,
	`max_qty` int NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `container_rule_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `bundle` ADD `type` enum('fixed','custom') DEFAULT 'fixed' NOT NULL;--> statement-breakpoint
ALTER TABLE `bundle` ADD `container_id` int;--> statement-breakpoint
ALTER TABLE `order_item` ADD `bundle_line` int;--> statement-breakpoint
ALTER TABLE `container_rule` ADD CONSTRAINT `container_rule_container_id_product_id_fk` FOREIGN KEY (`container_id`) REFERENCES `product`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `container_rule` ADD CONSTRAINT `container_rule_category_id_category_id_fk` FOREIGN KEY (`category_id`) REFERENCES `category`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `container_rule` ADD CONSTRAINT `container_rule_product_id_product_id_fk` FOREIGN KEY (`product_id`) REFERENCES `product`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `container_rule` ADD CONSTRAINT `container_rule_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `container_rule_owner_idx` ON `container_rule` (`container_id`,`sort_order`);--> statement-breakpoint
ALTER TABLE `bundle` ADD CONSTRAINT `bundle_container_id_product_id_fk` FOREIGN KEY (`container_id`) REFERENCES `product`(`id`) ON DELETE restrict ON UPDATE no action;