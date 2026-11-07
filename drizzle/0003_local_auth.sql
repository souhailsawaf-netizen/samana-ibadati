CREATE TABLE `auth_attempts` (
	`key` varchar(64) NOT NULL,
	`attempts` int NOT NULL DEFAULT 0,
	`windowStartedAt` timestamp NOT NULL,
	`lockedUntil` timestamp,
	CONSTRAINT `auth_attempts_key` PRIMARY KEY(`key`)
);
--> statement-breakpoint
CREATE TABLE `local_accounts` (
	`userId` int NOT NULL,
	`username` varchar(32) NOT NULL,
	`passwordHash` varchar(255) NOT NULL,
	`tokenVersion` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`passwordUpdatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `local_accounts_userId` PRIMARY KEY(`userId`),
	CONSTRAINT `local_accounts_username_idx` UNIQUE(`username`)
);
--> statement-breakpoint
ALTER TABLE `local_accounts` ADD CONSTRAINT `local_accounts_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;