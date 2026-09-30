CREATE TABLE `campaign_link` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(16) NOT NULL,
	`label` varchar(120) NOT NULL,
	`target_path` varchar(255) NOT NULL,
	`utm_source` varchar(100),
	`utm_medium` varchar(100),
	`utm_campaign` varchar(100),
	`utm_content` varchar(100),
	`ref_code` varchar(32),
	`clicks` int NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `campaign_link_id` PRIMARY KEY(`id`),
	CONSTRAINT `campaign_link_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `traffic_source` (
	`id` int AUTO_INCREMENT NOT NULL,
	`utm_source` varchar(100) NOT NULL DEFAULT '',
	`utm_medium` varchar(100) NOT NULL DEFAULT '',
	`utm_campaign` varchar(100) NOT NULL DEFAULT '',
	`utm_content` varchar(100) NOT NULL DEFAULT '',
	`ref_code` varchar(32) NOT NULL DEFAULT '',
	CONSTRAINT `traffic_source_id` PRIMARY KEY(`id`),
	CONSTRAINT `traffic_source_key_idx` UNIQUE(`utm_source`,`utm_medium`,`utm_campaign`,`utm_content`,`ref_code`)
);
--> statement-breakpoint
CREATE TABLE `account` (
	`id` varchar(255) NOT NULL,
	`account_id` varchar(255) NOT NULL,
	`provider_id` varchar(255) NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` datetime,
	`refresh_token_expires_at` datetime,
	`scope` text,
	`password` text,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	CONSTRAINT `account_id` PRIMARY KEY(`id`),
	CONSTRAINT `account_provider_account_idx` UNIQUE(`provider_id`,`account_id`)
);
--> statement-breakpoint
CREATE TABLE `roles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(32) NOT NULL,
	`description` varchar(255),
	`is_active` boolean NOT NULL DEFAULT true,
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `roles_id` PRIMARY KEY(`id`),
	CONSTRAINT `roles_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` varchar(255) NOT NULL,
	`token` varchar(255) NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`expires_at` datetime NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	CONSTRAINT `session_id` PRIMARY KEY(`id`),
	CONSTRAINT `session_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` varchar(255) NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(255) NOT NULL,
	`email_verified` boolean NOT NULL DEFAULT false,
	`image` text,
	`role` enum('customer','staff','admin') NOT NULL DEFAULT 'customer',
	`role_id` int,
	`phone` varchar(20),
	`locale` enum('en','am') NOT NULL DEFAULT 'en',
	`telegram_chat_id` varchar(32),
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `user_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `verification` (
	`id` varchar(255) NOT NULL,
	`identifier` varchar(255) NOT NULL,
	`value` text NOT NULL,
	`expires_at` datetime NOT NULL,
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	CONSTRAINT `verification_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `category` (
	`id` int AUTO_INCREMENT NOT NULL,
	`kind` enum('gift','rental') NOT NULL,
	`slug` varchar(120) NOT NULL,
	`name` varchar(120) NOT NULL,
	`name_am` varchar(120),
	`parent_id` int,
	`sort_order` int NOT NULL DEFAULT 0,
	`status` boolean NOT NULL DEFAULT true,
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `category_id` PRIMARY KEY(`id`),
	CONSTRAINT `category_slug_unique` UNIQUE(`slug`),
	CONSTRAINT `category_kind_name_idx` UNIQUE(`kind`,`name`)
);
--> statement-breakpoint
CREATE TABLE `product` (
	`id` int AUTO_INCREMENT NOT NULL,
	`kind` enum('gift','rental') NOT NULL,
	`category_id` int NOT NULL,
	`slug` varchar(160) NOT NULL,
	`name` varchar(160) NOT NULL,
	`name_am` varchar(160),
	`description` text,
	`description_am` text,
	`price` decimal(12,2),
	`daily_rate` decimal(12,2),
	`deposit` decimal(12,2) NOT NULL DEFAULT 0,
	`min_rental_days` int NOT NULL DEFAULT 1,
	`stock_qty` int NOT NULL DEFAULT 0,
	`low_stock_threshold` int,
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
	CONSTRAINT `product_id` PRIMARY KEY(`id`),
	CONSTRAINT `product_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `product_image` (
	`id` int AUTO_INCREMENT NOT NULL,
	`product_id` int NOT NULL,
	`file_name` varchar(64) NOT NULL,
	`alt` varchar(160),
	`alt_am` varchar(160),
	`sort_order` int NOT NULL DEFAULT 0,
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `product_image_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stock_movement` (
	`id` int AUTO_INCREMENT NOT NULL,
	`product_id` int NOT NULL,
	`delta` int NOT NULL,
	`reason` enum('sale','sale_cancel','delivery','damage','loss','adjustment','opening') NOT NULL,
	`ref_type` varchar(20),
	`ref_id` int,
	`note` varchar(255),
	`created_by` varchar(255),
	`created_at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `stock_movement_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customer` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` varchar(255),
	`name` varchar(120) NOT NULL,
	`phone` varchar(20) NOT NULL,
	`email` varchar(190),
	`telegram_user_id` varchar(32),
	`telegram_chat_id` varchar(32),
	`locale` enum('en','am') NOT NULL DEFAULT 'en',
	`default_address` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	CONSTRAINT `customer_id` PRIMARY KEY(`id`),
	CONSTRAINT `customer_user_id_unique` UNIQUE(`user_id`),
	CONSTRAINT `customer_phone_unique` UNIQUE(`phone`),
	CONSTRAINT `customer_telegram_user_id_unique` UNIQUE(`telegram_user_id`)
);
--> statement-breakpoint
CREATE TABLE `decor_package` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(160) NOT NULL,
	`event_type_id` int NOT NULL,
	`tier` enum('basic','premium','luxury') NOT NULL,
	`name` varchar(160) NOT NULL,
	`name_am` varchar(160),
	`summary` text,
	`summary_am` text,
	`inclusions` longtext,
	`inclusions_am` longtext,
	`starting_price` decimal(12,2) NOT NULL,
	`keyword` varchar(20),
	`sort_order` int NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `decor_package_id` PRIMARY KEY(`id`),
	CONSTRAINT `decor_package_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `event_type` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(60) NOT NULL,
	`name` varchar(80) NOT NULL,
	`name_am` varchar(80),
	`sort_order` int NOT NULL DEFAULT 0,
	`status` boolean NOT NULL DEFAULT true,
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `event_type_id` PRIMARY KEY(`id`),
	CONSTRAINT `event_type_slug_unique` UNIQUE(`slug`),
	CONSTRAINT `event_type_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `package_image` (
	`id` int AUTO_INCREMENT NOT NULL,
	`package_id` int NOT NULL,
	`file_name` varchar(64) NOT NULL,
	`alt` varchar(160),
	`alt_am` varchar(160),
	`sort_order` int NOT NULL DEFAULT 0,
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `package_image_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `portfolio_image` (
	`id` int AUTO_INCREMENT NOT NULL,
	`portfolio_item_id` int NOT NULL,
	`file_name` varchar(64) NOT NULL,
	`alt` varchar(160),
	`alt_am` varchar(160),
	`sort_order` int NOT NULL DEFAULT 0,
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `portfolio_image_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `portfolio_item` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(160) NOT NULL,
	`title` varchar(160) NOT NULL,
	`title_am` varchar(160),
	`event_type_id` int,
	`event_date` date,
	`venue` varchar(160),
	`description` text,
	`description_am` text,
	`is_featured` boolean NOT NULL DEFAULT false,
	`sort_order` int NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `portfolio_item_id` PRIMARY KEY(`id`),
	CONSTRAINT `portfolio_item_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `quote` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ref` varchar(20),
	`public_token` varchar(32) NOT NULL,
	`quote_request_id` int,
	`customer_id` int NOT NULL,
	`contact_name` varchar(120) NOT NULL,
	`contact_phone` varchar(20) NOT NULL,
	`contact_email` varchar(190),
	`event_type_id` int,
	`event_date` date,
	`venue` varchar(160),
	`subtotal` decimal(12,2) NOT NULL DEFAULT 0,
	`discount` decimal(12,2) NOT NULL DEFAULT 0,
	`total` decimal(12,2) NOT NULL DEFAULT 0,
	`deposit_due` decimal(12,2) NOT NULL DEFAULT 0,
	`amount_paid` decimal(12,2) NOT NULL DEFAULT 0,
	`status` enum('draft','sent','viewed','accepted','deposit_paid','paid','declined','expired','cancelled','superseded') NOT NULL DEFAULT 'draft',
	`valid_until` date,
	`sent_at` datetime,
	`viewed_at` datetime,
	`accepted_at` datetime,
	`superseded_by_id` int,
	`customer_note` text,
	`internal_note` text,
	`created_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	CONSTRAINT `quote_id` PRIMARY KEY(`id`),
	CONSTRAINT `quote_ref_unique` UNIQUE(`ref`),
	CONSTRAINT `quote_public_token_unique` UNIQUE(`public_token`)
);
--> statement-breakpoint
CREATE TABLE `quote_item` (
	`id` int AUTO_INCREMENT NOT NULL,
	`quote_id` int NOT NULL,
	`description` varchar(255) NOT NULL,
	`description_am` varchar(255),
	`qty` int NOT NULL DEFAULT 1,
	`unit_price` decimal(12,2) NOT NULL,
	`line_total` decimal(12,2) NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `quote_item_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quote_request` (
	`id` int AUTO_INCREMENT NOT NULL,
	`public_token` varchar(32) NOT NULL,
	`customer_id` int NOT NULL,
	`contact_name` varchar(120) NOT NULL,
	`contact_phone` varchar(20) NOT NULL,
	`contact_email` varchar(190),
	`event_type_id` int,
	`event_date` date,
	`venue` varchar(160),
	`guest_count` int,
	`theme` varchar(160),
	`budget` decimal(12,2),
	`package_id` int,
	`message` text,
	`preferred_channel` enum('whatsapp','telegram','sms','email','phone') NOT NULL DEFAULT 'phone',
	`status` enum('new','contacted','quoted','won','lost') NOT NULL DEFAULT 'new',
	`assigned_to` varchar(255),
	`source_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	CONSTRAINT `quote_request_id` PRIMARY KEY(`id`),
	CONSTRAINT `quote_request_public_token_unique` UNIQUE(`public_token`)
);
--> statement-breakpoint
CREATE TABLE `permissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(50) NOT NULL,
	`description` varchar(255),
	CONSTRAINT `permissions_id` PRIMARY KEY(`id`),
	CONSTRAINT `permissions_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `role_permissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`role_id` int NOT NULL,
	`permission_id` int NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `role_permissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `special_permissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`permission_id` int NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `special_permissions_id` PRIMARY KEY(`id`),
	CONSTRAINT `special_permissions_user_perm_idx` UNIQUE(`user_id`,`permission_id`)
);
--> statement-breakpoint
CREATE TABLE `order_item` (
	`id` int AUTO_INCREMENT NOT NULL,
	`order_id` int NOT NULL,
	`product_id` int NOT NULL,
	`name_snapshot` varchar(160) NOT NULL,
	`unit_price` decimal(12,2) NOT NULL,
	`qty` int NOT NULL,
	`line_total` decimal(12,2) NOT NULL,
	CONSTRAINT `order_item_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ref` varchar(20),
	`public_token` varchar(32) NOT NULL,
	`customer_id` int NOT NULL,
	`contact_name` varchar(120) NOT NULL,
	`contact_phone` varchar(20) NOT NULL,
	`contact_email` varchar(190),
	`fulfilment` enum('pickup','delivery') NOT NULL DEFAULT 'pickup',
	`delivery_address` varchar(255),
	`subtotal` decimal(12,2) NOT NULL,
	`delivery_fee` decimal(12,2) NOT NULL DEFAULT 0,
	`total` decimal(12,2) NOT NULL,
	`status` enum('pending_payment','paid','preparing','ready','completed','cancelled','expired','paid_unfulfillable') NOT NULL DEFAULT 'pending_payment',
	`hold_expires_at` datetime,
	`paid_at` datetime,
	`source_id` int,
	`locale` enum('en','am') NOT NULL DEFAULT 'en',
	`notes` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	CONSTRAINT `orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `orders_ref_unique` UNIQUE(`ref`),
	CONSTRAINT `orders_public_token_unique` UNIQUE(`public_token`)
);
--> statement-breakpoint
CREATE TABLE `rental_booking` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ref` varchar(20),
	`public_token` varchar(32) NOT NULL,
	`customer_id` int NOT NULL,
	`contact_name` varchar(120) NOT NULL,
	`contact_phone` varchar(20) NOT NULL,
	`contact_email` varchar(190),
	`start_date` date NOT NULL,
	`end_date` date NOT NULL,
	`days` int NOT NULL,
	`subtotal` decimal(12,2) NOT NULL,
	`deposit` decimal(12,2) NOT NULL DEFAULT 0,
	`total` decimal(12,2) NOT NULL,
	`status` enum('pending_payment','confirmed','out','returned','cancelled','expired','paid_unfulfillable') NOT NULL DEFAULT 'pending_payment',
	`hold_expires_at` datetime,
	`paid_at` datetime,
	`picked_up_at` datetime,
	`returned_at` datetime,
	`reminder_sent_at` datetime,
	`return_note` varchar(255),
	`source_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	CONSTRAINT `rental_booking_id` PRIMARY KEY(`id`),
	CONSTRAINT `rental_booking_ref_unique` UNIQUE(`ref`),
	CONSTRAINT `rental_booking_public_token_unique` UNIQUE(`public_token`)
);
--> statement-breakpoint
CREATE TABLE `rental_booking_item` (
	`id` int AUTO_INCREMENT NOT NULL,
	`booking_id` int NOT NULL,
	`product_id` int NOT NULL,
	`name_snapshot` varchar(160) NOT NULL,
	`qty` int NOT NULL,
	`daily_rate_snapshot` decimal(12,2) NOT NULL,
	`line_total` decimal(12,2) NOT NULL,
	CONSTRAINT `rental_booking_item_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `course` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(160) NOT NULL,
	`title` varchar(160) NOT NULL,
	`title_am` varchar(160),
	`summary` text,
	`summary_am` text,
	`curriculum` longtext,
	`curriculum_am` longtext,
	`fee` decimal(12,2) NOT NULL,
	`duration_text` varchar(120),
	`sort_order` int NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `course_id` PRIMARY KEY(`id`),
	CONSTRAINT `course_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `course_image` (
	`id` int AUTO_INCREMENT NOT NULL,
	`course_id` int NOT NULL,
	`file_name` varchar(64) NOT NULL,
	`alt` varchar(160),
	`alt_am` varchar(160),
	`sort_order` int NOT NULL DEFAULT 0,
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `course_image_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `course_intake` (
	`id` int AUTO_INCREMENT NOT NULL,
	`course_id` int NOT NULL,
	`start_date` date NOT NULL,
	`end_date` date,
	`schedule_text` varchar(160),
	`seat_limit` int NOT NULL,
	`status` enum('open','closed','completed','cancelled') NOT NULL DEFAULT 'open',
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	CONSTRAINT `course_intake_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `registration` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ref` varchar(20),
	`public_token` varchar(32) NOT NULL,
	`intake_id` int NOT NULL,
	`customer_id` int NOT NULL,
	`contact_name` varchar(120) NOT NULL,
	`contact_phone` varchar(20) NOT NULL,
	`contact_email` varchar(190),
	`fee_snapshot` decimal(12,2) NOT NULL,
	`status` enum('pending_payment','confirmed','cancelled','expired','paid_unfulfillable') NOT NULL DEFAULT 'pending_payment',
	`hold_expires_at` datetime,
	`paid_at` datetime,
	`result` enum('pending','graduated','not_graduated') NOT NULL DEFAULT 'pending',
	`result_notified_at` datetime,
	`source_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	CONSTRAINT `registration_id` PRIMARY KEY(`id`),
	CONSTRAINT `registration_ref_unique` UNIQUE(`ref`),
	CONSTRAINT `registration_public_token_unique` UNIQUE(`public_token`)
);
--> statement-breakpoint
CREATE TABLE `payment` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tx_ref` varchar(64) NOT NULL,
	`provider` enum('chapa','telebirr','cash','bank_transfer') NOT NULL,
	`provider_ref` varchar(100),
	`purpose` enum('order','rental','quote_deposit','quote_balance','registration') NOT NULL,
	`order_id` int,
	`rental_booking_id` int,
	`quote_id` int,
	`registration_id` int,
	`amount` decimal(12,2) NOT NULL,
	`status` enum('initiated','success','failed','cancelled') NOT NULL DEFAULT 'initiated',
	`checkout_url` varchar(500),
	`verified_at` datetime,
	`verify_payload` text,
	`receipt_file` varchar(64),
	`recorded_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	CONSTRAINT `payment_id` PRIMARY KEY(`id`),
	CONSTRAINT `payment_tx_ref_unique` UNIQUE(`tx_ref`)
);
--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` varchar(255),
	`action` varchar(20) NOT NULL,
	`table_name` varchar(64) NOT NULL,
	`record_id` varchar(64) NOT NULL,
	`changes` longtext,
	`ip_address` varchar(45),
	`branch_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `job_lock` (
	`name` varchar(64) NOT NULL,
	`locked_until` datetime,
	`last_run_at` datetime,
	`last_error` varchar(255),
	CONSTRAINT `job_lock_name` PRIMARY KEY(`name`)
);
--> statement-breakpoint
CREATE TABLE `message` (
	`id` int AUTO_INCREMENT NOT NULL,
	`channel` enum('sms','email','telegram') NOT NULL,
	`recipient` varchar(190) NOT NULL,
	`template` varchar(50) NOT NULL,
	`locale` enum('en','am') NOT NULL DEFAULT 'en',
	`params` longtext,
	`status` enum('queued','sending','sent','failed') NOT NULL DEFAULT 'queued',
	`attempts` tinyint NOT NULL DEFAULT 0,
	`next_attempt_at` datetime,
	`last_error` varchar(255),
	`provider_message_id` varchar(100),
	`related_type` varchar(20),
	`related_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`sent_at` datetime,
	CONSTRAINT `message_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `setting` (
	`key` varchar(64) NOT NULL,
	`value` text NOT NULL,
	`updated_by` varchar(255),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	CONSTRAINT `setting_key` PRIMARY KEY(`key`)
);
--> statement-breakpoint
ALTER TABLE `campaign_link` ADD CONSTRAINT `campaign_link_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `campaign_link` ADD CONSTRAINT `campaign_link_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `campaign_link` ADD CONSTRAINT `campaign_link_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `account` ADD CONSTRAINT `account_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `roles` ADD CONSTRAINT `roles_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `session` ADD CONSTRAINT `session_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user` ADD CONSTRAINT `user_role_id_roles_id_fk` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `category` ADD CONSTRAINT `category_parent_id_category_id_fk` FOREIGN KEY (`parent_id`) REFERENCES `category`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `category` ADD CONSTRAINT `category_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product` ADD CONSTRAINT `product_category_id_category_id_fk` FOREIGN KEY (`category_id`) REFERENCES `category`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product` ADD CONSTRAINT `product_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product` ADD CONSTRAINT `product_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product` ADD CONSTRAINT `product_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_image` ADD CONSTRAINT `product_image_product_id_product_id_fk` FOREIGN KEY (`product_id`) REFERENCES `product`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_image` ADD CONSTRAINT `product_image_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_movement` ADD CONSTRAINT `stock_movement_product_id_product_id_fk` FOREIGN KEY (`product_id`) REFERENCES `product`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_movement` ADD CONSTRAINT `stock_movement_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customer` ADD CONSTRAINT `customer_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `decor_package` ADD CONSTRAINT `decor_package_event_type_id_event_type_id_fk` FOREIGN KEY (`event_type_id`) REFERENCES `event_type`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `decor_package` ADD CONSTRAINT `decor_package_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `decor_package` ADD CONSTRAINT `decor_package_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `decor_package` ADD CONSTRAINT `decor_package_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `event_type` ADD CONSTRAINT `event_type_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `package_image` ADD CONSTRAINT `package_image_package_id_decor_package_id_fk` FOREIGN KEY (`package_id`) REFERENCES `decor_package`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `package_image` ADD CONSTRAINT `package_image_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `portfolio_image` ADD CONSTRAINT `portfolio_image_portfolio_item_id_portfolio_item_id_fk` FOREIGN KEY (`portfolio_item_id`) REFERENCES `portfolio_item`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `portfolio_image` ADD CONSTRAINT `portfolio_image_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `portfolio_item` ADD CONSTRAINT `portfolio_item_event_type_id_event_type_id_fk` FOREIGN KEY (`event_type_id`) REFERENCES `event_type`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `portfolio_item` ADD CONSTRAINT `portfolio_item_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `portfolio_item` ADD CONSTRAINT `portfolio_item_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `portfolio_item` ADD CONSTRAINT `portfolio_item_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `quote` ADD CONSTRAINT `quote_quote_request_id_quote_request_id_fk` FOREIGN KEY (`quote_request_id`) REFERENCES `quote_request`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `quote` ADD CONSTRAINT `quote_customer_id_customer_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customer`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `quote` ADD CONSTRAINT `quote_event_type_id_event_type_id_fk` FOREIGN KEY (`event_type_id`) REFERENCES `event_type`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `quote` ADD CONSTRAINT `quote_superseded_by_id_quote_id_fk` FOREIGN KEY (`superseded_by_id`) REFERENCES `quote`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `quote` ADD CONSTRAINT `quote_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `quote_item` ADD CONSTRAINT `quote_item_quote_id_quote_id_fk` FOREIGN KEY (`quote_id`) REFERENCES `quote`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `quote_item` ADD CONSTRAINT `quote_item_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `quote_request` ADD CONSTRAINT `quote_request_customer_id_customer_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customer`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `quote_request` ADD CONSTRAINT `quote_request_event_type_id_event_type_id_fk` FOREIGN KEY (`event_type_id`) REFERENCES `event_type`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `quote_request` ADD CONSTRAINT `quote_request_package_id_decor_package_id_fk` FOREIGN KEY (`package_id`) REFERENCES `decor_package`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `quote_request` ADD CONSTRAINT `quote_request_assigned_to_user_id_fk` FOREIGN KEY (`assigned_to`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `quote_request` ADD CONSTRAINT `quote_request_source_id_traffic_source_id_fk` FOREIGN KEY (`source_id`) REFERENCES `traffic_source`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_role_id_roles_id_fk` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_permission_id_permissions_id_fk` FOREIGN KEY (`permission_id`) REFERENCES `permissions`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `special_permissions` ADD CONSTRAINT `special_permissions_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `special_permissions` ADD CONSTRAINT `special_permissions_permission_id_permissions_id_fk` FOREIGN KEY (`permission_id`) REFERENCES `permissions`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `special_permissions` ADD CONSTRAINT `special_permissions_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `special_permissions` ADD CONSTRAINT `special_permissions_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `special_permissions` ADD CONSTRAINT `special_permissions_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_item` ADD CONSTRAINT `order_item_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_item` ADD CONSTRAINT `order_item_product_id_product_id_fk` FOREIGN KEY (`product_id`) REFERENCES `product`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_customer_id_customer_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customer`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_source_id_traffic_source_id_fk` FOREIGN KEY (`source_id`) REFERENCES `traffic_source`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `rental_booking` ADD CONSTRAINT `rental_booking_customer_id_customer_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customer`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `rental_booking` ADD CONSTRAINT `rental_booking_source_id_traffic_source_id_fk` FOREIGN KEY (`source_id`) REFERENCES `traffic_source`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `rental_booking_item` ADD CONSTRAINT `rental_booking_item_booking_id_rental_booking_id_fk` FOREIGN KEY (`booking_id`) REFERENCES `rental_booking`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `rental_booking_item` ADD CONSTRAINT `rental_booking_item_product_id_product_id_fk` FOREIGN KEY (`product_id`) REFERENCES `product`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `course` ADD CONSTRAINT `course_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `course` ADD CONSTRAINT `course_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `course` ADD CONSTRAINT `course_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `course_image` ADD CONSTRAINT `course_image_course_id_course_id_fk` FOREIGN KEY (`course_id`) REFERENCES `course`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `course_image` ADD CONSTRAINT `course_image_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `course_intake` ADD CONSTRAINT `course_intake_course_id_course_id_fk` FOREIGN KEY (`course_id`) REFERENCES `course`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `course_intake` ADD CONSTRAINT `course_intake_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `registration` ADD CONSTRAINT `registration_intake_id_course_intake_id_fk` FOREIGN KEY (`intake_id`) REFERENCES `course_intake`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `registration` ADD CONSTRAINT `registration_customer_id_customer_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customer`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `registration` ADD CONSTRAINT `registration_source_id_traffic_source_id_fk` FOREIGN KEY (`source_id`) REFERENCES `traffic_source`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payment` ADD CONSTRAINT `payment_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payment` ADD CONSTRAINT `payment_rental_booking_id_rental_booking_id_fk` FOREIGN KEY (`rental_booking_id`) REFERENCES `rental_booking`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payment` ADD CONSTRAINT `payment_quote_id_quote_id_fk` FOREIGN KEY (`quote_id`) REFERENCES `quote`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payment` ADD CONSTRAINT `payment_registration_id_registration_id_fk` FOREIGN KEY (`registration_id`) REFERENCES `registration`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payment` ADD CONSTRAINT `payment_recorded_by_user_id_fk` FOREIGN KEY (`recorded_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_log` ADD CONSTRAINT `audit_log_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `setting` ADD CONSTRAINT `setting_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `account_user_id_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE INDEX `session_user_id_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE INDEX `session_expires_idx` ON `session` (`expires_at`);--> statement-breakpoint
CREATE INDEX `user_role_idx` ON `user` (`role`);--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);--> statement-breakpoint
CREATE INDEX `verification_expires_idx` ON `verification` (`expires_at`);--> statement-breakpoint
CREATE INDEX `product_kind_category_idx` ON `product` (`kind`,`category_id`,`published_at`);--> statement-breakpoint
CREATE INDEX `product_featured_idx` ON `product` (`is_featured`);--> statement-breakpoint
CREATE INDEX `product_image_owner_idx` ON `product_image` (`product_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `stock_movement_product_idx` ON `stock_movement` (`product_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `stock_movement_ref_idx` ON `stock_movement` (`ref_type`,`ref_id`);--> statement-breakpoint
CREATE INDEX `customer_email_idx` ON `customer` (`email`);--> statement-breakpoint
CREATE INDEX `decor_package_event_idx` ON `decor_package` (`event_type_id`,`tier`);--> statement-breakpoint
CREATE INDEX `package_image_owner_idx` ON `package_image` (`package_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `portfolio_image_owner_idx` ON `portfolio_image` (`portfolio_item_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `portfolio_item_event_idx` ON `portfolio_item` (`event_type_id`,`is_featured`);--> statement-breakpoint
CREATE INDEX `quote_status_event_idx` ON `quote` (`status`,`event_date`);--> statement-breakpoint
CREATE INDEX `quote_customer_idx` ON `quote` (`customer_id`);--> statement-breakpoint
CREATE INDEX `quote_status_valid_idx` ON `quote` (`status`,`valid_until`);--> statement-breakpoint
CREATE INDEX `quote_item_owner_idx` ON `quote_item` (`quote_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `quote_request_status_idx` ON `quote_request` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `quote_request_customer_idx` ON `quote_request` (`customer_id`);--> statement-breakpoint
CREATE INDEX `role_permissions_role_idx` ON `role_permissions` (`role_id`,`permission_id`);--> statement-breakpoint
CREATE INDEX `order_item_order_idx` ON `order_item` (`order_id`);--> statement-breakpoint
CREATE INDEX `orders_status_hold_idx` ON `orders` (`status`,`hold_expires_at`);--> statement-breakpoint
CREATE INDEX `orders_customer_idx` ON `orders` (`customer_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `rental_booking_status_end_idx` ON `rental_booking` (`status`,`end_date`);--> statement-breakpoint
CREATE INDEX `rental_booking_dates_idx` ON `rental_booking` (`start_date`,`end_date`);--> statement-breakpoint
CREATE INDEX `rental_booking_status_hold_idx` ON `rental_booking` (`status`,`hold_expires_at`);--> statement-breakpoint
CREATE INDEX `rental_booking_customer_idx` ON `rental_booking` (`customer_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `rental_booking_item_product_idx` ON `rental_booking_item` (`product_id`,`booking_id`);--> statement-breakpoint
CREATE INDEX `course_image_owner_idx` ON `course_image` (`course_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `course_intake_course_idx` ON `course_intake` (`course_id`,`status`,`start_date`);--> statement-breakpoint
CREATE INDEX `registration_intake_idx` ON `registration` (`intake_id`,`status`);--> statement-breakpoint
CREATE INDEX `registration_status_hold_idx` ON `registration` (`status`,`hold_expires_at`);--> statement-breakpoint
CREATE INDEX `registration_customer_idx` ON `registration` (`customer_id`);--> statement-breakpoint
CREATE INDEX `payment_status_idx` ON `payment` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `payment_order_idx` ON `payment` (`order_id`);--> statement-breakpoint
CREATE INDEX `payment_rental_idx` ON `payment` (`rental_booking_id`);--> statement-breakpoint
CREATE INDEX `payment_quote_idx` ON `payment` (`quote_id`);--> statement-breakpoint
CREATE INDEX `payment_registration_idx` ON `payment` (`registration_id`);--> statement-breakpoint
CREATE INDEX `audit_log_record_idx` ON `audit_log` (`table_name`,`record_id`,`id`);--> statement-breakpoint
CREATE INDEX `message_status_next_idx` ON `message` (`status`,`next_attempt_at`);--> statement-breakpoint
CREATE INDEX `message_related_idx` ON `message` (`related_type`,`related_id`);