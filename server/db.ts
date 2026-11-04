import { and, desc, eq, gte, isNull, lte, sql, type SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, User, dailyLogs, programSettings, studentInvites, studentProfiles, users, weeklyGoals } from "../drizzle/schema";
import type { GoalTask, ProgramItem, ProgramStage } from "../shared/program";
import { DEFAULT_PROGRAM_ITEMS } from "../shared/program";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  type TextField = (typeof textFields)[number];
  const assignNullable = (field: TextField) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  };
  textFields.forEach(assignNullable);
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  values.lastSignedIn ??= new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getStudentProfile(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(studentProfiles).where(eq(studentProfiles.userId, userId)).limit(1);
  return result[0] ?? null;
}

export async function saveStudentProfile(input: { userId: number; displayName: string; stage: ProgramStage; grade: string; active?: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const active = input.active ?? true;
  await db.insert(studentProfiles).values({ ...input, active }).onDuplicateKeyUpdate({
    set: { displayName: input.displayName, stage: input.stage, grade: input.grade, active, updatedAt: new Date() },
  });
  return getStudentProfile(input.userId);
}

export async function createStudentInvite(input: { code: string; displayName: string; stage: ProgramStage; grade: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(studentInvites).values(input);
}

export async function getAdminInvites() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(studentInvites).orderBy(desc(studentInvites.createdAt)).limit(500);
}

export async function claimStudentInvite(userId: number, code: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const existingProfile = await getStudentProfile(userId);
  if (existingProfile) return existingProfile.active ? existingProfile : null;
  const invite = (await db.select().from(studentInvites).where(and(eq(studentInvites.code, code), eq(studentInvites.active, true))).limit(1))[0];
  if (!invite || (invite.claimedByUserId && invite.claimedByUserId !== userId)) return null;
  if (!invite.claimedByUserId) {
    await db.update(studentInvites).set({ claimedByUserId: userId, claimedAt: new Date() }).where(and(eq(studentInvites.id, invite.id), isNull(studentInvites.claimedByUserId), eq(studentInvites.active, true)));
  }
  const claimed = (await db.select().from(studentInvites).where(and(eq(studentInvites.id, invite.id), eq(studentInvites.claimedByUserId, userId), eq(studentInvites.active, true))).limit(1))[0];
  if (!claimed) return null;
  return saveStudentProfile({ userId, displayName: claimed.displayName, stage: claimed.stage, grade: claimed.grade, active: true });
}

export async function deactivateStudentInvite(inviteId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(studentInvites).set({ active: false }).where(eq(studentInvites.id, inviteId));
}

export async function saveDailyAnswers(userId: number, logDate: string, answers: Record<string, string>) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(dailyLogs).values({ userId, logDate, answers }).onDuplicateKeyUpdate({
    set: { answers, updatedAt: new Date() },
  });
}

export async function getDailyLog(userId: number, logDate: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(dailyLogs).where(and(eq(dailyLogs.userId, userId), eq(dailyLogs.logDate, logDate))).limit(1);
  return result[0] ?? null;
}

export async function getStudentHistory(userId: number, from?: string, to?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions: SQL[] = [eq(dailyLogs.userId, userId)];
  if (from) conditions.push(gte(dailyLogs.logDate, from));
  if (to) conditions.push(lte(dailyLogs.logDate, to));
  return db.select().from(dailyLogs).where(and(...conditions)).orderBy(desc(dailyLogs.logDate)).limit(45);
}

export async function getWeeklyGoal(userId: number, weekStart: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(weeklyGoals).where(and(eq(weeklyGoals.userId, userId), eq(weeklyGoals.weekStart, weekStart))).limit(1);
  return rows[0] ?? null;
}

export async function saveWeeklyGoal(userId: number, weekStart: string, title: string, tasks: GoalTask[]) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(weeklyGoals).values({ userId, weekStart, title, tasks }).onDuplicateKeyUpdate({
    set: { title, tasks, updatedAt: new Date() },
  });
  return getWeeklyGoal(userId, weekStart);
}

export async function getProgram() {
  const db = await getDb();
  if (!db) return { id: 1, title: "برنامج عبادتي", startDate: "", endDate: "", dailyItems: DEFAULT_PROGRAM_ITEMS };
  const rows = await db.select().from(programSettings).where(eq(programSettings.id, 1)).limit(1);
  if (!rows[0]) return { id: 1, title: "برنامج عبادتي", startDate: "", endDate: "", dailyItems: DEFAULT_PROGRAM_ITEMS };
  const stored = rows[0];
  const dailyItems = stored.dailyItems.map(item => ({
    ...item,
    choices: item.choices?.length ? item.choices : (DEFAULT_PROGRAM_ITEMS.find(defaultItem => defaultItem.key === item.key)?.choices ?? []),
  }));
  return { ...stored, dailyItems };
}

export async function saveProgram(input: { title: string; startDate: string; endDate: string; dailyItems: ProgramItem[] }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(programSettings).values({ id: 1, ...input }).onDuplicateKeyUpdate({ set: { ...input, updatedAt: new Date() } });
  return getProgram();
}

export type AdminRosterRow = {
  userId: number;
  loginName: string | null;
  role: User["role"];
  displayName: string | null;
  stage: ProgramStage | null;
  grade: string | null;
  active: boolean | null;
};

export async function getAdminRoster() {
  const db = await getDb();
  if (!db) return [] as AdminRosterRow[];
  return db.select({
    userId: users.id,
    loginName: users.name,
    role: users.role,
    displayName: studentProfiles.displayName,
    stage: studentProfiles.stage,
    grade: studentProfiles.grade,
    active: studentProfiles.active,
  }).from(users).leftJoin(studentProfiles, eq(studentProfiles.userId, users.id)).orderBy(users.id).limit(500);
}

export async function setUserRole(userId: number, role: "user" | "admin") {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, userId));
}

export async function getAdminLogs(filters: { from?: string; to?: string; userId?: number; stage?: ProgramStage; grade?: string; activity?: string; limit?: number }) {
  const db = await getDb();
  if (!db) return [];
  const conditions: SQL[] = [];
  if (filters.from) conditions.push(gte(dailyLogs.logDate, filters.from));
  if (filters.to) conditions.push(lte(dailyLogs.logDate, filters.to));
  if (filters.userId) conditions.push(eq(dailyLogs.userId, filters.userId));
  if (filters.stage) conditions.push(eq(studentProfiles.stage, filters.stage));
  if (filters.grade) conditions.push(eq(studentProfiles.grade, filters.grade));
  if (filters.activity) conditions.push(sql`JSON_CONTAINS_PATH(${dailyLogs.answers}, 'one', ${`$."${filters.activity}"`})`);
  const query = db.select({
    id: dailyLogs.id,
    userId: dailyLogs.userId,
    logDate: dailyLogs.logDate,
    answers: dailyLogs.answers,
    studentName: studentProfiles.displayName,
    stage: studentProfiles.stage,
    grade: studentProfiles.grade,
  }).from(dailyLogs).innerJoin(studentProfiles, eq(dailyLogs.userId, studentProfiles.userId));
  const limit = Math.min(Math.max(filters.limit ?? 3000, 1), 5000);
  return conditions.length
    ? query.where(and(...conditions)).orderBy(desc(dailyLogs.logDate)).limit(limit)
    : query.orderBy(desc(dailyLogs.logDate)).limit(limit);
}
