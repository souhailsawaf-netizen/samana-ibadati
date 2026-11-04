CREATE TABLE `student_invites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(24) NOT NULL,
	`displayName` varchar(160) NOT NULL,
	`inviteStage` enum('primary','middle') NOT NULL,
	`grade` varchar(40) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`claimedByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`claimedAt` timestamp,
	CONSTRAINT `student_invites_id` PRIMARY KEY(`id`),
	CONSTRAINT `student_invites_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
ALTER TABLE `student_invites` ADD CONSTRAINT `student_invites_claimedByUserId_users_id_fk` FOREIGN KEY (`claimedByUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;