CREATE TABLE `renter` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`slug` varchar(120) NOT NULL,
	`business_name` varchar(160) NOT NULL,
	`business_name_am` varchar(160),
	`tagline` varchar(160),
	`tagline_am` varchar(160),
	`about` text,
	`about_am` text,
	`policies` text,
	`policies_am` text,
	`logo_file` varchar(64),
	`cover_file` varchar(64),
	`area` varchar(120),
	`service_areas` varchar(255),
	`founded_year` int,
	`offers_delivery` boolean NOT NULL DEFAULT false,
	`offers_setup` boolean NOT NULL DEFAULT false,
	`phone` varchar(20) NOT NULL,
	`whatsapp` varchar(20),
	`telegram` varchar(40),
	`tin_number` varchar(20) NOT NULL,
	`trade_licence_file` varchar(64) NOT NULL,
	`status` enum('pending','approved','rejected','suspended') NOT NULL DEFAULT 'pending',
	`review_note` varchar(255),
	`reviewed_by` varchar(255),
	`reviewed_at` datetime,
	`approved_at` datetime,
	`auto_publish` boolean NOT NULL DEFAULT false,
	`is_featured` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	CONSTRAINT `renter_id` PRIMARY KEY(`id`),
	CONSTRAINT `renter_user_id_unique` UNIQUE(`user_id`),
	CONSTRAINT `renter_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `renter_bank_account` (
	`id` int AUTO_INCREMENT NOT NULL,
	`renter_id` int NOT NULL,
	`bank_name` varchar(80) NOT NULL,
	`account_name` varchar(120) NOT NULL,
	`account_number` varchar(40) NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	`status` boolean NOT NULL DEFAULT true,
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `renter_bank_account_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `renter_listing` (
	`id` int AUTO_INCREMENT NOT NULL,
	`renter_id` int NOT NULL,
	`category_id` int NOT NULL,
	`slug` varchar(160) NOT NULL,
	`name` varchar(160) NOT NULL,
	`name_am` varchar(160),
	`summary` varchar(255),
	`summary_am` varchar(255),
	`description` text,
	`description_am` text,
	`features` longtext,
	`features_am` longtext,
	`pricing` enum('fixed','quote') NOT NULL DEFAULT 'fixed',
	`price` decimal(12,2),
	`price_unit` enum('day','event','hour','item') NOT NULL DEFAULT 'day',
	`deposit` decimal(12,2) NOT NULL DEFAULT 0,
	`quantity` int NOT NULL DEFAULT 1,
	`capacity` int,
	`youtube_url` varchar(255),
	`delivery_available` boolean NOT NULL DEFAULT false,
	`setup_included` boolean NOT NULL DEFAULT false,
	`status` enum('draft','pending_review','approved','rejected','paused') NOT NULL DEFAULT 'draft',
	`review_note` varchar(255),
	`reviewed_by` varchar(255),
	`reviewed_at` datetime,
	`published_at` datetime,
	`sort_order` int NOT NULL DEFAULT 0,
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	CONSTRAINT `renter_listing_id` PRIMARY KEY(`id`),
	CONSTRAINT `renter_listing_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `renter_listing_image` (
	`id` int AUTO_INCREMENT NOT NULL,
	`listing_id` int NOT NULL,
	`file_name` varchar(64) NOT NULL,
	`alt` varchar(160),
	`alt_am` varchar(160),
	`sort_order` int NOT NULL DEFAULT 0,
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `renter_listing_image_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `renter_order` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ref` varchar(20),
	`public_token` varchar(32) NOT NULL,
	`renter_id` int NOT NULL,
	`listing_id` int,
	`customer_id` int NOT NULL,
	`contact_name` varchar(120) NOT NULL,
	`contact_phone` varchar(20) NOT NULL,
	`contact_email` varchar(190),
	`origin` enum('buy_now','quote') NOT NULL,
	`title_snapshot` varchar(160) NOT NULL,
	`start_date` date NOT NULL,
	`end_date` date NOT NULL,
	`qty` int NOT NULL DEFAULT 1,
	`hours` int,
	`price_unit` enum('day','event','hour','item'),
	`unit_price` decimal(12,2),
	`subtotal` decimal(12,2),
	`deposit` decimal(12,2) NOT NULL DEFAULT 0,
	`total` decimal(12,2),
	`venue` varchar(200),
	`message` text,
	`renter_note` text,
	`quoted_at` datetime,
	`valid_until` date,
	`accepted_at` datetime,
	`hold_expires_at` datetime,
	`paid_at` datetime,
	`status` enum('quote_requested','quoted','pending_payment','payment_review','confirmed','out','completed','declined','cancelled','expired') NOT NULL,
	`locale` enum('en','am') NOT NULL DEFAULT 'en',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	CONSTRAINT `renter_order_id` PRIMARY KEY(`id`),
	CONSTRAINT `renter_order_ref_unique` UNIQUE(`ref`),
	CONSTRAINT `renter_order_public_token_unique` UNIQUE(`public_token`)
);
--> statement-breakpoint
CREATE TABLE `renter_payment` (
	`id` int AUTO_INCREMENT NOT NULL,
	`order_id` int NOT NULL,
	`bank_account_id` int NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`receipt_file` varchar(64) NOT NULL,
	`status` enum('submitted','accepted','rejected') NOT NULL DEFAULT 'submitted',
	`review_note` varchar(255),
	`reviewed_at` datetime,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	CONSTRAINT `renter_payment_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `user` MODIFY COLUMN `role` enum('customer','staff','admin','renter') NOT NULL DEFAULT 'customer';--> statement-breakpoint
ALTER TABLE `renter` ADD CONSTRAINT `renter_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `renter` ADD CONSTRAINT `renter_reviewed_by_user_id_fk` FOREIGN KEY (`reviewed_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `renter_bank_account` ADD CONSTRAINT `renter_bank_account_renter_id_renter_id_fk` FOREIGN KEY (`renter_id`) REFERENCES `renter`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `renter_bank_account` ADD CONSTRAINT `renter_bank_account_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `renter_listing` ADD CONSTRAINT `renter_listing_renter_id_renter_id_fk` FOREIGN KEY (`renter_id`) REFERENCES `renter`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `renter_listing` ADD CONSTRAINT `renter_listing_category_id_category_id_fk` FOREIGN KEY (`category_id`) REFERENCES `category`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `renter_listing` ADD CONSTRAINT `renter_listing_reviewed_by_user_id_fk` FOREIGN KEY (`reviewed_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `renter_listing` ADD CONSTRAINT `renter_listing_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `renter_listing_image` ADD CONSTRAINT `renter_listing_image_listing_id_renter_listing_id_fk` FOREIGN KEY (`listing_id`) REFERENCES `renter_listing`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `renter_listing_image` ADD CONSTRAINT `renter_listing_image_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `renter_order` ADD CONSTRAINT `renter_order_renter_id_renter_id_fk` FOREIGN KEY (`renter_id`) REFERENCES `renter`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `renter_order` ADD CONSTRAINT `renter_order_listing_id_renter_listing_id_fk` FOREIGN KEY (`listing_id`) REFERENCES `renter_listing`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `renter_order` ADD CONSTRAINT `renter_order_customer_id_customer_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customer`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `renter_payment` ADD CONSTRAINT `renter_payment_order_id_renter_order_id_fk` FOREIGN KEY (`order_id`) REFERENCES `renter_order`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `renter_payment` ADD CONSTRAINT `renter_payment_bank_account_id_renter_bank_account_id_fk` FOREIGN KEY (`bank_account_id`) REFERENCES `renter_bank_account`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `renter_status_idx` ON `renter` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `renter_bank_account_owner_idx` ON `renter_bank_account` (`renter_id`);--> statement-breakpoint
CREATE INDEX `renter_listing_status_idx` ON `renter_listing` (`status`,`category_id`);--> statement-breakpoint
CREATE INDEX `renter_listing_owner_idx` ON `renter_listing` (`renter_id`,`status`);--> statement-breakpoint
CREATE INDEX `renter_listing_image_owner_idx` ON `renter_listing_image` (`listing_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `renter_order_owner_idx` ON `renter_order` (`renter_id`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `renter_order_status_hold_idx` ON `renter_order` (`status`,`hold_expires_at`);--> statement-breakpoint
CREATE INDEX `renter_order_listing_dates_idx` ON `renter_order` (`listing_id`,`start_date`,`end_date`);--> statement-breakpoint
CREATE INDEX `renter_payment_order_idx` ON `renter_payment` (`order_id`);--> statement-breakpoint
CREATE INDEX `renter_payment_status_idx` ON `renter_payment` (`status`);