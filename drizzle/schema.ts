import {
  boolean,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import type { GoalTask, ProgramItem, ProgramStage } from "../shared/program";
import type { DailyStory } from "../shared/stories";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const localAccounts = mysqlTable(
  "local_accounts",
  {
    userId: int("userId")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    username: varchar("username", { length: 32 }).notNull(),
    passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
    tokenVersion: int("tokenVersion").notNull().default(0),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    passwordUpdatedAt: timestamp("passwordUpdatedAt").defaultNow().notNull(),
  },
  table => ({ usernameIdx: uniqueIndex("local_accounts_username_idx").on(table.username) })
);

export const authAttempts = mysqlTable("auth_attempts", {
  key: varchar("key", { length: 64 }).primaryKey(),
  attempts: int("attempts").notNull().default(0),
  windowStartedAt: timestamp("windowStartedAt").notNull(),
  lockedUntil: timestamp("lockedUntil"),
});

export const studentProfiles = mysqlTable(
  "student_profiles",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    displayName: varchar("displayName", { length: 160 }).notNull(),
    stage: mysqlEnum("stage", ["primary", "middle"])
      .$type<ProgramStage>()
      .notNull()
      .default("primary"),
    grade: varchar("grade", { length: 40 }).notNull().default(""),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    userIdx: uniqueIndex("student_profiles_user_idx").on(table.userId),
  })
);

export const studentInvites = mysqlTable("student_invites", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 24 }).notNull().unique(),
  displayName: varchar("displayName", { length: 160 }).notNull(),
  stage: mysqlEnum("inviteStage", ["primary", "middle"])
    .$type<ProgramStage>()
    .notNull(),
  grade: varchar("grade", { length: 40 }).notNull(),
  active: boolean("active").notNull().default(true),
  claimedByUserId: int("claimedByUserId").references(() => users.id, {
    onDelete: "cascade",
  }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  claimedAt: timestamp("claimedAt"),
});

export const dailyLogs = mysqlTable(
  "daily_logs",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    logDate: varchar("logDate", { length: 10 }).notNull(),
    answers: json("answers").$type<Record<string, string>>().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    userDateIdx: uniqueIndex("daily_logs_user_date_idx").on(
      table.userId,
      table.logDate
    ),
  })
);

export const weeklyGoals = mysqlTable(
  "weekly_goals",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    weekStart: varchar("weekStart", { length: 10 }).notNull(),
    title: varchar("title", { length: 180 }).notNull(),
    tasks: json("tasks").$type<GoalTask[]>().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    userWeekIdx: uniqueIndex("weekly_goals_user_week_idx").on(
      table.userId,
      table.weekStart
    ),
  })
);

export const programSettings = mysqlTable("program_settings", {
  id: int("id").primaryKey().default(1),
  title: varchar("title", { length: 180 }).notNull().default("برنامج عبادتي"),
  startDate: varchar("startDate", { length: 10 }).notNull().default(""),
  endDate: varchar("endDate", { length: 10 }).notNull().default(""),
  dailyItems: json("dailyItems").$type<ProgramItem[]>().notNull(),
  dailyStories: json("dailyStories").$type<DailyStory[]>(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
