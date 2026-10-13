ALTER TABLE `quote_request` ADD `kind` enum('decor','space','contact') DEFAULT 'decor' NOT NULL;--> statement-breakpoint
ALTER TABLE `quote_request` ADD `space_id` int;--> statement-breakpoint
ALTER TABLE `quote_request` ADD CONSTRAINT `quote_request_space_id_rental_space_id_fk` FOREIGN KEY (`space_id`) REFERENCES `rental_space`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `quote_request_kind_idx` ON `quote_request` (`kind`,`created_at`);