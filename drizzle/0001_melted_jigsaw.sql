CREATE TABLE `daily_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`logDate` varchar(10) NOT NULL,
	`answers` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `daily_logs_id` PRIMARY KEY(`id`),
	CONSTRAINT `daily_logs_user_date_idx` UNIQUE(`userId`,`logDate`)
);
--> statement-breakpoint
CREATE TABLE `program_settings` (
	`id` int NOT NULL DEFAULT 1,
	`title` varchar(180) NOT NULL DEFAULT 'برنامج عبادتي',
	`startDate` varchar(10) NOT NULL DEFAULT '',
	`endDate` varchar(10) NOT NULL DEFAULT '',
	`dailyItems` json NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `program_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `student_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`displayName` varchar(160) NOT NULL,
	`stage` enum('primary','middle') NOT NULL DEFAULT 'primary',
	`grade` varchar(40) NOT NULL DEFAULT '',
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `student_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `student_profiles_user_idx` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `weekly_goals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`weekStart` varchar(10) NOT NULL,
	`title` varchar(180) NOT NULL,
	`tasks` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `weekly_goals_id` PRIMARY KEY(`id`),
	CONSTRAINT `weekly_goals_user_week_idx` UNIQUE(`userId`,`weekStart`)
);
--> statement-breakpoint
ALTER TABLE `daily_logs` ADD CONSTRAINT `daily_logs_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `student_profiles` ADD CONSTRAINT `student_profiles_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `weekly_goals` ADD CONSTRAINT `weekly_goals_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;