CREATE TABLE `bank_account` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bank_name` varchar(80) NOT NULL,
	`account_name` varchar(120) NOT NULL,
	`account_number` varchar(40) NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	`status` boolean NOT NULL DEFAULT true,
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `bank_account_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `payment` ADD `bank_account_id` int;--> statement-breakpoint
ALTER TABLE `bank_account` ADD CONSTRAINT `bank_account_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payment` ADD CONSTRAINT `payment_bank_account_id_bank_account_id_fk` FOREIGN KEY (`bank_account_id`) REFERENCES `bank_account`(`id`) ON DELETE restrict ON UPDATE no action;