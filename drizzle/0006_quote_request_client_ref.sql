ALTER TABLE `quote_request` ADD `client_ref` varchar(40);--> statement-breakpoint
ALTER TABLE `quote_request` ADD CONSTRAINT `quote_request_client_ref_unique` UNIQUE(`client_ref`);