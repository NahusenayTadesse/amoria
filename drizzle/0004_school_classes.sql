CREATE TABLE `school_shift` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(60) NOT NULL,
	`name_am` varchar(60),
	`time_text` varchar(60),
	`sort_order` int NOT NULL DEFAULT 0,
	`status` boolean NOT NULL DEFAULT true,
	`deleted_at` datetime,
	`deleted_by` varchar(255),
	CONSTRAINT `school_shift_id` PRIMARY KEY(`id`),
	CONSTRAINT `school_shift_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
ALTER TABLE `course` ADD `duration_days` int;--> statement-breakpoint
ALTER TABLE `course` ADD `max_students` int;--> statement-breakpoint
ALTER TABLE `course_intake` ADD `shift_id` int;--> statement-breakpoint
ALTER TABLE `registration` ADD `certificate_no` varchar(32);--> statement-breakpoint
ALTER TABLE `registration` ADD `certificate_issued_at` datetime;--> statement-breakpoint
ALTER TABLE `registration` ADD CONSTRAINT `registration_certificate_no_unique` UNIQUE(`certificate_no`);--> statement-breakpoint
ALTER TABLE `school_shift` ADD CONSTRAINT `school_shift_deleted_by_user_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `user`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `course_intake` ADD CONSTRAINT `course_intake_shift_id_school_shift_id_fk` FOREIGN KEY (`shift_id`) REFERENCES `school_shift`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `course_intake_shift_idx` ON `course_intake` (`shift_id`);