CREATE TABLE `stock_count` (
	`id` int AUTO_INCREMENT NOT NULL,
	`location_id` int NOT NULL,
	`category_id` int,
	`count_date` date NOT NULL,
	`status` enum('open','posted','cancelled') NOT NULL DEFAULT 'open',
	`blind` boolean NOT NULL DEFAULT true,
	`note` text,
	`adjustment_id` int,
	`posted_at` datetime,
	`posted_by` varchar(255),
	`created_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	CONSTRAINT `stock_count_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stock_count_line` (
	`id` int AUTO_INCREMENT NOT NULL,
	`count_id` int NOT NULL,
	`product_id` int NOT NULL,
	`lot_id` int,
	`lot_key` int NOT NULL DEFAULT 0,
	`expected` int NOT NULL,
	`counted` int,
	`added_during_count` boolean NOT NULL DEFAULT false,
	`note` varchar(255),
	`counted_by` varchar(255),
	CONSTRAINT `stock_count_line_id` PRIMARY KEY(`id`),
	CONSTRAINT `stock_count_line_key_idx` UNIQUE(`count_id`,`product_id`,`lot_key`)
);
--> statement-breakpoint
CREATE TABLE `supplier` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`phone` varchar(30) NOT NULL,
	`email` varchar(190),
	`address` varchar(255),
	`tin` varchar(20),
	`vat_registered` boolean NOT NULL DEFAULT false,
	`lead_time_days` int,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_by` varchar(255),
	`updated_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `supplier_id` PRIMARY KEY(`id`),
	CONSTRAINT `supplier_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `location` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`kind` enum('shop','storage','workshop','quarantine') NOT NULL DEFAULT 'storage',
	`sort_order` int NOT NULL DEFAULT 0,
	`status` boolean NOT NULL DEFAULT true,
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `location_id` PRIMARY KEY(`id`),
	CONSTRAINT `location_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `number_sequence` (
	`id` int AUTO_INCREMENT NOT NULL,
	`doc_type` varchar(20) NOT NULL,
	`fiscal_year` int NOT NULL,
	`last_number` int NOT NULL DEFAULT 0,
	CONSTRAINT `number_sequence_id` PRIMARY KEY(`id`),
	CONSTRAINT `number_sequence_key_idx` UNIQUE(`doc_type`,`fiscal_year`)
);
--> statement-breakpoint
CREATE TABLE `reorder_rule` (
	`id` int AUTO_INCREMENT NOT NULL,
	`product_id` int NOT NULL,
	`location_id` int NOT NULL,
	`min_quantity` int NOT NULL,
	`max_quantity` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reorder_rule_id` PRIMARY KEY(`id`),
	CONSTRAINT `reorder_rule_key_idx` UNIQUE(`location_id`,`product_id`)
);
--> statement-breakpoint
CREATE TABLE `stock_balance` (
	`id` int AUTO_INCREMENT NOT NULL,
	`location_id` int NOT NULL,
	`product_id` int NOT NULL,
	`lot_id` int,
	`lot_key` int NOT NULL DEFAULT 0,
	`quantity` int NOT NULL DEFAULT 0,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	CONSTRAINT `stock_balance_id` PRIMARY KEY(`id`),
	CONSTRAINT `stock_balance_key_idx` UNIQUE(`location_id`,`product_id`,`lot_key`)
);
--> statement-breakpoint
CREATE TABLE `stock_document` (
	`id` int AUTO_INCREMENT NOT NULL,
	`type` enum('receipt','issue','transfer','adjustment','sales_return','purchase_return') NOT NULL,
	`status` enum('draft','posted','cancelled') NOT NULL DEFAULT 'draft',
	`number` varchar(40),
	`doc_date` date NOT NULL,
	`from_location_id` int,
	`to_location_id` int,
	`reference` varchar(80),
	`supplier_id` int,
	`party` varchar(160),
	`customer_id` int,
	`reason` enum('count','damage','expiry','found','opening','other'),
	`note` text,
	`purchase_order_id` int,
	`requisition_id` int,
	`shift_id` int,
	`return_of_id` int,
	`subtotal` decimal(12,2),
	`vat_total` decimal(12,2),
	`total` decimal(12,2),
	`posted_at` datetime,
	`posted_by` varchar(255),
	`created_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	CONSTRAINT `stock_document_id` PRIMARY KEY(`id`),
	CONSTRAINT `stock_document_number_unique` UNIQUE(`number`)
);
--> statement-breakpoint
CREATE TABLE `stock_document_line` (
	`id` int AUTO_INCREMENT NOT NULL,
	`document_id` int NOT NULL,
	`product_id` int NOT NULL,
	`quantity` int NOT NULL,
	`unit_cost` decimal(12,4),
	`unit_price` decimal(12,2),
	`list_price` decimal(12,2),
	`vat_rate` decimal(5,2),
	`lot_id` int,
	`lot_number` varchar(60),
	`expiry_date` date,
	`return_of_line_id` int,
	`purchase_order_line_id` int,
	`note` varchar(255),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `stock_document_line_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stock_lot` (
	`id` int AUTO_INCREMENT NOT NULL,
	`product_id` int NOT NULL,
	`lot_number` varchar(60) NOT NULL,
	`expiry_date` date,
	`status` enum('available','quarantine','recalled') NOT NULL DEFAULT 'available',
	`supplier_id` int,
	`note` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stock_lot_id` PRIMARY KEY(`id`),
	CONSTRAINT `stock_lot_product_number_idx` UNIQUE(`product_id`,`lot_number`)
);
--> statement-breakpoint
CREATE TABLE `purchase_order` (
	`id` int AUTO_INCREMENT NOT NULL,
	`supplier_id` int NOT NULL,
	`number` varchar(40),
	`status` enum('draft','ordered','partially_received','received','closed','cancelled') NOT NULL DEFAULT 'draft',
	`order_date` date NOT NULL,
	`expected_date` date,
	`location_id` int NOT NULL,
	`reference` varchar(80),
	`note` text,
	`ordered_at` datetime,
	`ordered_by` varchar(255),
	`created_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	CONSTRAINT `purchase_order_id` PRIMARY KEY(`id`),
	CONSTRAINT `purchase_order_number_unique` UNIQUE(`number`)
);
--> statement-breakpoint
CREATE TABLE `purchase_order_line` (
	`id` int AUTO_INCREMENT NOT NULL,
	`purchase_order_id` int NOT NULL,
	`product_id` int NOT NULL,
	`quantity` int NOT NULL,
	`unit_cost` decimal(12,4),
	`note` varchar(255),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `purchase_order_line_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `requisition` (
	`id` int AUTO_INCREMENT NOT NULL,
	`number` varchar(40),
	`status` enum('draft','submitted','approved','rejected','issued','cancelled') NOT NULL DEFAULT 'draft',
	`purpose` enum('decor','school','shop','rental','other') NOT NULL DEFAULT 'decor',
	`requester` varchar(120) NOT NULL,
	`quote_id` int,
	`request_date` date NOT NULL,
	`needed_by` date,
	`location_id` int NOT NULL,
	`note` text,
	`submitted_at` datetime,
	`submitted_by` varchar(255),
	`decided_at` datetime,
	`decided_by` varchar(255),
	`decision_note` varchar(255),
	`created_by` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(3) on update CURRENT_TIMESTAMP(3),
	CONSTRAINT `requisition_id` PRIMARY KEY(`id`),
	CONSTRAINT `requisition_number_unique` UNIQUE(`number`)
);
--> statement-breakpoint
CREATE TABLE `requisition_line` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requisition_id` int NOT NULL,
	`product_id` int NOT NULL,
	`quantity` int NOT NULL,
	`approved_quantity` int,
	`note` varchar(255),
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `requisition_line_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pos_payment` (
	`id` int AUTO_INCREMENT NOT NULL,
	`document_id` int NOT NULL,
	`shift_id` int NOT NULL,
	`method` enum('cash','telebirr','cbe_birr','bank_transfer','card') NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`reference` varchar(80),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pos_payment_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pos_shift` (
	`id` int AUTO_INCREMENT NOT NULL,
	`status` enum('open','closed') NOT NULL DEFAULT 'open',
	`location_id` int NOT NULL,
	`opened_by` varchar(255),
	`opened_at` timestamp NOT NULL DEFAULT (now()),
	`float_amount` decimal(12,2) NOT NULL DEFAULT 0,
	`closed_by` varchar(255),
	`closed_at` datetime,
	`expected_cash` decimal(12,2),
	`counted_cash` decimal(12,2),
	`note` text,
	CONSTRAINT `pos_shift_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `category` MODIFY COLUMN `kind` enum('gift','rental','material') NOT NULL;--> statement-breakpoint
ALTER TABLE `product` MODIFY COLUMN `kind` enum('gift','rental','material') NOT NULL;--> statement-breakpoint
ALTER TABLE `stock_movement` MODIFY COLUMN `reason` enum('sale','sale_cancel','delivery','damage','loss','expiry','adjustment','opening','transfer_in','transfer_out','issue','customer_return','supplier_return','pos_sale') NOT NULL;--> statement-breakpoint
ALTER TABLE `product` ADD `sku` varchar(40);--> statement-breakpoint
ALTER TABLE `product` ADD `barcode` varchar(40);--> statement-breakpoint
ALTER TABLE `product` ADD `unit` varchar(20) DEFAULT 'pcs' NOT NULL;--> statement-breakpoint
ALTER TABLE `product` ADD `track_lots` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `product` ADD `avg_cost` decimal(12,4) DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `product` ADD `main_supplier_id` int;--> statement-breakpoint
ALTER TABLE `product` ADD `tax_code` enum('standard','zero','exempt') DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE `stock_movement` ADD `location_id` int;--> statement-breakpoint
ALTER TABLE `stock_movement` ADD `lot_id` int;--> statement-breakpoint
ALTER TABLE `stock_movement` ADD `unit_cost` decimal(12,4) DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `stock_movement` ADD `document_id` int;--> statement-breakpoint
ALTER TABLE `stock_movement` ADD `doc_date` date;--> statement-breakpoint
-- Existing stock: everything the shop holds today sits on the shop floor, and every past movement
-- happened there. Amoria's business day is Addis Ababa time (UTC+3).
INSERT INTO `location` (`name`, `kind`, `sort_order`) VALUES ('Shop floor', 'shop', 0), ('Store room', 'storage', 1), ('Workshop', 'workshop', 2), ('Quarantine', 'quarantine', 9);--> statement-breakpoint
UPDATE `stock_movement` SET `location_id` = (SELECT `id` FROM `location` WHERE `kind` = 'shop' ORDER BY `id` LIMIT 1), `doc_date` = DATE(DATE_ADD(`created_at`, INTERVAL 3 HOUR));--> statement-breakpoint
ALTER TABLE `stock_movement` MODIFY COLUMN `location_id` int NOT NULL;--> statement-breakpoint
ALTER TABLE `stock_movement` MODIFY COLUMN `doc_date` date NOT NULL;--> statement-breakpoint
INSERT INTO `stock_balance` (`location_id`, `product_id`, `lot_key`, `quantity`) SELECT (SELECT `id` FROM `location` WHERE `kind` = 'shop' ORDER BY `id` LIMIT 1), `id`, 0, `stock_qty` FROM `product` WHERE `stock_qty` > 0;--> statement-breakpoint
ALTER TABLE `product` ADD CONSTRAINT `product_sku_unique` UNIQUE(`sku`);--> statement-breakpoint
ALTER TABLE `product` ADD CONSTRAINT `product_barcode_unique` UNIQUE(`barcode`);--> statement-breakpoint
ALTER TABLE `stock_count` ADD CONSTRAINT `stock_count_location_id_location_id_fk` FOREIGN KEY (`location_id`) REFERENCES `location`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_count` ADD CONSTRAINT `stock_count_category_id_category_id_fk` FOREIGN KEY (`category_id`) REFERENCES `category`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_count` ADD CONSTRAINT `stock_count_adjustment_id_stock_document_id_fk` FOREIGN KEY (`adjustment_id`) REFERENCES `stock_document`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_count` ADD CONSTRAINT `stock_count_posted_by_user_id_fk` FOREIGN KEY (`posted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_count` ADD CONSTRAINT `stock_count_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_count_line` ADD CONSTRAINT `stock_count_line_count_id_stock_count_id_fk` FOREIGN KEY (`count_id`) REFERENCES `stock_count`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_count_line` ADD CONSTRAINT `stock_count_line_product_id_product_id_fk` FOREIGN KEY (`product_id`) REFERENCES `product`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_count_line` ADD CONSTRAINT `stock_count_line_lot_id_stock_lot_id_fk` FOREIGN KEY (`lot_id`) REFERENCES `stock_lot`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_count_line` ADD CONSTRAINT `stock_count_line_counted_by_user_id_fk` FOREIGN KEY (`counted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `supplier` ADD CONSTRAINT `supplier_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `supplier` ADD CONSTRAINT `supplier_updated_by_user_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `supplier` ADD CONSTRAINT `supplier_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `location` ADD CONSTRAINT `location_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reorder_rule` ADD CONSTRAINT `reorder_rule_product_id_product_id_fk` FOREIGN KEY (`product_id`) REFERENCES `product`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reorder_rule` ADD CONSTRAINT `reorder_rule_location_id_location_id_fk` FOREIGN KEY (`location_id`) REFERENCES `location`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_balance` ADD CONSTRAINT `stock_balance_location_id_location_id_fk` FOREIGN KEY (`location_id`) REFERENCES `location`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_balance` ADD CONSTRAINT `stock_balance_product_id_product_id_fk` FOREIGN KEY (`product_id`) REFERENCES `product`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_balance` ADD CONSTRAINT `stock_balance_lot_id_stock_lot_id_fk` FOREIGN KEY (`lot_id`) REFERENCES `stock_lot`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_document` ADD CONSTRAINT `stock_document_from_location_id_location_id_fk` FOREIGN KEY (`from_location_id`) REFERENCES `location`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_document` ADD CONSTRAINT `stock_document_to_location_id_location_id_fk` FOREIGN KEY (`to_location_id`) REFERENCES `location`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_document` ADD CONSTRAINT `stock_document_supplier_id_supplier_id_fk` FOREIGN KEY (`supplier_id`) REFERENCES `supplier`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_document` ADD CONSTRAINT `stock_document_customer_id_customer_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customer`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_document` ADD CONSTRAINT `stock_document_purchase_order_id_purchase_order_id_fk` FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_order`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_document` ADD CONSTRAINT `stock_document_requisition_id_requisition_id_fk` FOREIGN KEY (`requisition_id`) REFERENCES `requisition`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_document` ADD CONSTRAINT `stock_document_shift_id_pos_shift_id_fk` FOREIGN KEY (`shift_id`) REFERENCES `pos_shift`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_document` ADD CONSTRAINT `stock_document_return_of_id_stock_document_id_fk` FOREIGN KEY (`return_of_id`) REFERENCES `stock_document`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_document` ADD CONSTRAINT `stock_document_posted_by_user_id_fk` FOREIGN KEY (`posted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_document` ADD CONSTRAINT `stock_document_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_document_line` ADD CONSTRAINT `stock_document_line_document_id_stock_document_id_fk` FOREIGN KEY (`document_id`) REFERENCES `stock_document`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_document_line` ADD CONSTRAINT `stock_document_line_product_id_product_id_fk` FOREIGN KEY (`product_id`) REFERENCES `product`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_document_line` ADD CONSTRAINT `stock_document_line_lot_id_stock_lot_id_fk` FOREIGN KEY (`lot_id`) REFERENCES `stock_lot`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_document_line` ADD CONSTRAINT `stock_document_line_return_of_line_id_stock_document_line_id_fk` FOREIGN KEY (`return_of_line_id`) REFERENCES `stock_document_line`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_document_line` ADD CONSTRAINT `stock_document_line_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_document_line` ADD CONSTRAINT `stock_document_line_po_line_fk` FOREIGN KEY (`purchase_order_line_id`) REFERENCES `purchase_order_line`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_lot` ADD CONSTRAINT `stock_lot_product_id_product_id_fk` FOREIGN KEY (`product_id`) REFERENCES `product`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_lot` ADD CONSTRAINT `stock_lot_supplier_id_supplier_id_fk` FOREIGN KEY (`supplier_id`) REFERENCES `supplier`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchase_order` ADD CONSTRAINT `purchase_order_supplier_id_supplier_id_fk` FOREIGN KEY (`supplier_id`) REFERENCES `supplier`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchase_order` ADD CONSTRAINT `purchase_order_location_id_location_id_fk` FOREIGN KEY (`location_id`) REFERENCES `location`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchase_order` ADD CONSTRAINT `purchase_order_ordered_by_user_id_fk` FOREIGN KEY (`ordered_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchase_order` ADD CONSTRAINT `purchase_order_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchase_order_line` ADD CONSTRAINT `purchase_order_line_purchase_order_id_purchase_order_id_fk` FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_order`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchase_order_line` ADD CONSTRAINT `purchase_order_line_product_id_product_id_fk` FOREIGN KEY (`product_id`) REFERENCES `product`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `purchase_order_line` ADD CONSTRAINT `purchase_order_line_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `requisition` ADD CONSTRAINT `requisition_quote_id_quote_id_fk` FOREIGN KEY (`quote_id`) REFERENCES `quote`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `requisition` ADD CONSTRAINT `requisition_location_id_location_id_fk` FOREIGN KEY (`location_id`) REFERENCES `location`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `requisition` ADD CONSTRAINT `requisition_submitted_by_user_id_fk` FOREIGN KEY (`submitted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `requisition` ADD CONSTRAINT `requisition_decided_by_user_id_fk` FOREIGN KEY (`decided_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `requisition` ADD CONSTRAINT `requisition_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `requisition_line` ADD CONSTRAINT `requisition_line_requisition_id_requisition_id_fk` FOREIGN KEY (`requisition_id`) REFERENCES `requisition`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `requisition_line` ADD CONSTRAINT `requisition_line_product_id_product_id_fk` FOREIGN KEY (`product_id`) REFERENCES `product`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `requisition_line` ADD CONSTRAINT `requisition_line_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pos_payment` ADD CONSTRAINT `pos_payment_document_id_stock_document_id_fk` FOREIGN KEY (`document_id`) REFERENCES `stock_document`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pos_payment` ADD CONSTRAINT `pos_payment_shift_id_pos_shift_id_fk` FOREIGN KEY (`shift_id`) REFERENCES `pos_shift`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pos_shift` ADD CONSTRAINT `pos_shift_location_id_location_id_fk` FOREIGN KEY (`location_id`) REFERENCES `location`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pos_shift` ADD CONSTRAINT `pos_shift_opened_by_user_id_fk` FOREIGN KEY (`opened_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pos_shift` ADD CONSTRAINT `pos_shift_closed_by_user_id_fk` FOREIGN KEY (`closed_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `stock_count_status_idx` ON `stock_count` (`status`);--> statement-breakpoint
CREATE INDEX `stock_balance_product_idx` ON `stock_balance` (`product_id`);--> statement-breakpoint
CREATE INDEX `stock_document_status_idx` ON `stock_document` (`status`,`type`);--> statement-breakpoint
CREATE INDEX `stock_document_date_idx` ON `stock_document` (`doc_date`);--> statement-breakpoint
CREATE INDEX `stock_document_shift_idx` ON `stock_document` (`shift_id`);--> statement-breakpoint
CREATE INDEX `stock_document_line_doc_idx` ON `stock_document_line` (`document_id`);--> statement-breakpoint
CREATE INDEX `stock_document_line_product_idx` ON `stock_document_line` (`product_id`);--> statement-breakpoint
CREATE INDEX `stock_lot_expiry_idx` ON `stock_lot` (`expiry_date`);--> statement-breakpoint
CREATE INDEX `purchase_order_status_idx` ON `purchase_order` (`status`);--> statement-breakpoint
CREATE INDEX `purchase_order_supplier_idx` ON `purchase_order` (`supplier_id`);--> statement-breakpoint
CREATE INDEX `purchase_order_line_po_idx` ON `purchase_order_line` (`purchase_order_id`);--> statement-breakpoint
CREATE INDEX `requisition_status_idx` ON `requisition` (`status`);--> statement-breakpoint
CREATE INDEX `requisition_line_req_idx` ON `requisition_line` (`requisition_id`);--> statement-breakpoint
CREATE INDEX `pos_payment_document_idx` ON `pos_payment` (`document_id`);--> statement-breakpoint
CREATE INDEX `pos_payment_shift_idx` ON `pos_payment` (`shift_id`);--> statement-breakpoint
CREATE INDEX `pos_shift_status_idx` ON `pos_shift` (`status`);--> statement-breakpoint
ALTER TABLE `product` ADD CONSTRAINT `product_main_supplier_id_supplier_id_fk` FOREIGN KEY (`main_supplier_id`) REFERENCES `supplier`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_movement` ADD CONSTRAINT `stock_movement_location_id_location_id_fk` FOREIGN KEY (`location_id`) REFERENCES `location`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_movement` ADD CONSTRAINT `stock_movement_lot_id_stock_lot_id_fk` FOREIGN KEY (`lot_id`) REFERENCES `stock_lot`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_movement` ADD CONSTRAINT `stock_movement_document_id_stock_document_id_fk` FOREIGN KEY (`document_id`) REFERENCES `stock_document`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `stock_movement_location_idx` ON `stock_movement` (`location_id`,`product_id`);--> statement-breakpoint
CREATE INDEX `stock_movement_document_idx` ON `stock_movement` (`document_id`);--> statement-breakpoint
CREATE INDEX `stock_movement_date_idx` ON `stock_movement` (`doc_date`);