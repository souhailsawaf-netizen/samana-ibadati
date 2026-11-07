import { and, desc, eq, gte, isNull, lte, sql, type SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2";
import {
  InsertUser,
  User,
  authAttempts,
  dailyLogs,
  localAccounts,
  programSettings,
  studentInvites,
  studentProfiles,
  users,
  weeklyGoals,
} from "../drizzle/schema";
import type { GoalTask, ProgramItem, ProgramStage } from "../shared/program";
import { DEFAULT_PROGRAM_ITEMS } from "../shared/program";
import { ENV } from "./_core/env";
import { hashPassword, normalizeUsername } from "./auth";

let _db: ReturnType<typeof drizzle> | null = null;
type Database = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export async function getDb() {
  if (!_db) {
    const tidbUrl = process.env.TIDB_DATABASE_URL;
    const tidbHost = process.env.TIDB_HOST;
    const tidbUser = process.env.TIDB_USER;
    const tidbPassword = process.env.TIDB_PASSWORD;
    const tidbDatabase = process.env.TIDB_DATABASE;

    if (tidbUrl) {
      const url = new URL(tidbUrl);
      const pool = mysql.createPool({
        host: url.hostname,
        port: Number(url.port || "4000"),
        user: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password),
        database: decodeURIComponent(url.pathname.replace(/^\//, "")),
        ssl: { rejectUnauthorized: true },
        connectionLimit: 5,
        waitForConnections: true,
      });
      _db = drizzle(pool);
    } else if (tidbHost && tidbUser && tidbPassword && tidbDatabase) {
      const pool = mysql.createPool({
        host: tidbHost,
        port: Number(process.env.TIDB_PORT ?? "4000"),
        user: tidbUser,
        password: tidbPassword,
        database: tidbDatabase,
        ssl: { rejectUnauthorized: true },
        connectionLimit: 5,
        waitForConnections: true,
      });
      _db = drizzle(pool);
    } else if (process.env.VERCEL === "1") {
      throw new Error("TiDB connection settings are required on Vercel");
    } else if (process.env.DATABASE_URL) {
      _db = drizzle(process.env.DATABASE_URL);
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
  await db
    .insert(users)
    .values(values)
    .onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);
  return result[0];
}

export async function getUserById(userId: number): Promise<User | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return result[0] ?? null;
}

export async function getAuthAccountByUserId(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select()
    .from(localAccounts)
    .where(eq(localAccounts.userId, userId))
    .limit(1);
  return result[0] ?? null;
}

export async function getAuthAccountByUsername(username: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db
    .select()
    .from(localAccounts)
    .where(eq(localAccounts.username, username))
    .limit(1);
  return result[0] ?? null;
}

export async function ensureInitialAdmin() {
  const username = normalizeUsername(process.env.INITIAL_ADMIN_USERNAME ?? "");
  const password = process.env.INITIAL_ADMIN_PASSWORD;
  if (!username || !password) return;
  if (!/^[a-z0-9][a-z0-9_-]{2,31}$/.test(username))
    throw new Error("INITIAL_ADMIN_USERNAME must be 3-32 lowercase letters or numbers");
  if (password.length < 16)
    throw new Error("INITIAL_ADMIN_PASSWORD must contain at least 16 characters");

  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const currentAdmin = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin")).limit(1);
  if (currentAdmin[0]) return;

  const existingAccount = await getAuthAccountByUsername(username);
  if (existingAccount) {
    const existingUser = await getUserById(existingAccount.userId);
    if (existingUser?.role === "admin") return;
    throw new Error("The bootstrap admin username is already assigned to a non-admin account");
  }

  const passwordHash = await hashPassword(password);
  const openId = `local:${username}`;
  await db.transaction(async tx => {
    const admins = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, "admin"))
      .for("update")
      .limit(1);
    if (admins[0]) return;

    const collisions = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.openId, openId))
      .limit(1);
    if (collisions[0]) throw new Error("Bootstrap admin identity already exists");

    await tx.insert(users).values({ openId, name: username, loginMethod: "local", role: "admin" });
    const created = await tx.select({ id: users.id }).from(users).where(eq(users.openId, openId)).limit(1);
    if (!created[0]) throw new Error("Failed to create bootstrap admin account");
    await tx.insert(localAccounts).values({ userId: created[0].id, username, passwordHash });
  });
}

export async function createStudentAccount(input: {
  username: string;
  passwordHash: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.transaction(async tx => {
    const duplicate = await tx
      .select({ userId: localAccounts.userId })
      .from(localAccounts)
      .where(eq(localAccounts.username, input.username))
      .limit(1);
    if (duplicate[0]) return { error: "USERNAME_TAKEN" as const };

    const openId = `local:${input.username}`;
    await tx.insert(users).values({
      openId,
      name: input.username,
      loginMethod: "local",
      role: "user",
      lastSignedIn: new Date(),
    });
    const created = await tx.select().from(users).where(eq(users.openId, openId)).limit(1);
    if (!created[0]) throw new Error("Failed to create student account");
    const user = created[0];

    await tx.insert(localAccounts).values({
      userId: user.id,
      username: input.username,
      passwordHash: input.passwordHash,
    });
    return { user };
  });
}

export async function getLoginLockUntil(key: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const row = await db.select().from(authAttempts).where(eq(authAttempts.key, key)).limit(1);
  return row[0]?.lockedUntil ?? null;
}

async function recordAuthAttempt(
  key: string,
  maxAttempts: number,
  now: Date
) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const windowMs = 15 * 60 * 1000;
  await db.transaction(async tx => {
    await tx
      .delete(authAttempts)
      .where(
        lte(
          authAttempts.windowStartedAt,
          new Date(now.getTime() - 24 * 60 * 60 * 1000)
        )
      );
    await tx
      .insert(authAttempts)
      .values({ key, attempts: 0, windowStartedAt: now, lockedUntil: null })
      .onDuplicateKeyUpdate({ set: { key: sql`${authAttempts.key}` } });
    const row = (
      await tx.select().from(authAttempts).where(eq(authAttempts.key, key)).for("update").limit(1)
    )[0];
    if (!row) throw new Error("Failed to load login attempt counter");
    const expired = now.getTime() - row.windowStartedAt.getTime() >= windowMs;
    const attempts = expired ? 1 : row.attempts + 1;
    const lockedUntil = attempts >= maxAttempts ? new Date(now.getTime() + windowMs) : expired ? null : row.lockedUntil;
    await tx
      .update(authAttempts)
      .set({ attempts, windowStartedAt: expired ? now : row.windowStartedAt, lockedUntil })
      .where(eq(authAttempts.key, key));
  });
}

export function recordFailedLogin(key: string, now = new Date()) {
  return recordAuthAttempt(key, 5, now);
}

export function recordSuccessfulRegistration(key: string, now = new Date()) {
  return recordAuthAttempt(key, 25, now);
}

export async function clearLoginFailures(key: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.delete(authAttempts).where(eq(authAttempts.key, key));
}

export async function updateLocalPassword(userId: number, passwordHash: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const account = await db
    .select({ userId: localAccounts.userId })
    .from(localAccounts)
    .where(eq(localAccounts.userId, userId))
    .limit(1);
  if (!account[0]) return false;
  await db
    .update(localAccounts)
    .set({
      passwordHash,
      passwordUpdatedAt: new Date(),
      tokenVersion: sql`${localAccounts.tokenVersion} + 1`,
    })
    .where(eq(localAccounts.userId, userId));
  return true;
}

export async function getStudentProfile(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select()
    .from(studentProfiles)
    .where(eq(studentProfiles.userId, userId))
    .limit(1);
  return result[0] ?? null;
}

type StudentProfileInput = {
  userId: number;
  displayName: string;
  stage: ProgramStage;
  grade: string;
  active?: boolean;
};

async function upsertStudentProfile(db: Database, input: StudentProfileInput) {
  const active = input.active ?? true;
  await db
    .insert(studentProfiles)
    .values({ ...input, active })
    .onDuplicateKeyUpdate({
      set: {
        displayName: input.displayName,
        stage: input.stage,
        grade: input.grade,
        active,
        updatedAt: new Date(),
      },
    });
}

export async function saveStudentProfile(input: StudentProfileInput) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await upsertStudentProfile(db, input);
  return getStudentProfile(input.userId);
}

export async function createStudentProfile(input: Omit<StudentProfileInput, "active">) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.transaction(async tx => {
    const user = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, input.userId))
      .for("update")
      .limit(1);
    if (!user[0]) return null;

    const existing = await tx
      .select({ id: studentProfiles.id })
      .from(studentProfiles)
      .where(eq(studentProfiles.userId, input.userId))
      .limit(1);
    if (existing[0]) return null;

    await tx.insert(studentProfiles).values({ ...input, active: true });
    const created = await tx
      .select()
      .from(studentProfiles)
      .where(eq(studentProfiles.userId, input.userId))
      .limit(1);
    return created[0] ?? null;
  });
}

export async function updateStudentProfile(input: StudentProfileInput) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const user = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1);
  if (!user[0]) return null;
  await upsertStudentProfile(db, input);
  return getStudentProfile(input.userId);
}

export async function createStudentInvite(input: {
  code: string;
  displayName: string;
  stage: ProgramStage;
  grade: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(studentInvites).values(input);
}

export async function getAdminInvites() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(studentInvites)
    .orderBy(desc(studentInvites.createdAt))
    .limit(500);
}

export async function claimStudentInvite(userId: number, code: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const existingProfile = await getStudentProfile(userId);
  if (existingProfile) return existingProfile.active ? existingProfile : null;
  const invite = (
    await db
      .select()
      .from(studentInvites)
      .where(
        and(eq(studentInvites.code, code), eq(studentInvites.active, true))
      )
      .limit(1)
  )[0];
  if (!invite || (invite.claimedByUserId && invite.claimedByUserId !== userId))
    return null;
  if (!invite.claimedByUserId) {
    await db
      .update(studentInvites)
      .set({ claimedByUserId: userId, claimedAt: new Date() })
      .where(
        and(
          eq(studentInvites.id, invite.id),
          isNull(studentInvites.claimedByUserId),
          eq(studentInvites.active, true)
        )
      );
  }
  const claimed = (
    await db
      .select()
      .from(studentInvites)
      .where(
        and(
          eq(studentInvites.id, invite.id),
          eq(studentInvites.claimedByUserId, userId),
          eq(studentInvites.active, true)
        )
      )
      .limit(1)
  )[0];
  if (!claimed) return null;
  return saveStudentProfile({
    userId,
    displayName: claimed.displayName,
    stage: claimed.stage,
    grade: claimed.grade,
    active: true,
  });
}

export async function deactivateStudentInvite(inviteId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const invite = await db
    .select({ id: studentInvites.id })
    .from(studentInvites)
    .where(eq(studentInvites.id, inviteId))
    .limit(1);
  if (!invite[0]) return false;
  await db
    .update(studentInvites)
    .set({ active: false })
    .where(eq(studentInvites.id, inviteId));
  return true;
}

export async function saveDailyAnswers(
  userId: number,
  logDate: string,
  answers: Record<string, string>
) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db
    .insert(dailyLogs)
    .values({ userId, logDate, answers })
    .onDuplicateKeyUpdate({
      set: { answers, updatedAt: new Date() },
    });
}

export async function getDailyLog(userId: number, logDate: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select()
    .from(dailyLogs)
    .where(and(eq(dailyLogs.userId, userId), eq(dailyLogs.logDate, logDate)))
    .limit(1);
  return result[0] ?? null;
}

export async function getStudentHistory(
  userId: number,
  from?: string,
  to?: string
) {
  const db = await getDb();
  if (!db) return [];
  const conditions: SQL[] = [eq(dailyLogs.userId, userId)];
  if (from) conditions.push(gte(dailyLogs.logDate, from));
  if (to) conditions.push(lte(dailyLogs.logDate, to));
  return db
    .select()
    .from(dailyLogs)
    .where(and(...conditions))
    .orderBy(desc(dailyLogs.logDate))
    .limit(45);
}

export async function getWeeklyGoal(userId: number, weekStart: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(weeklyGoals)
    .where(
      and(eq(weeklyGoals.userId, userId), eq(weeklyGoals.weekStart, weekStart))
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function saveWeeklyGoal(
  userId: number,
  weekStart: string,
  title: string,
  tasks: GoalTask[]
) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db
    .insert(weeklyGoals)
    .values({ userId, weekStart, title, tasks })
    .onDuplicateKeyUpdate({
      set: { title, tasks, updatedAt: new Date() },
    });
  return getWeeklyGoal(userId, weekStart);
}

export async function getProgram() {
  const db = await getDb();
  if (!db)
    return {
      id: 1,
      title: "برنامج عبادتي",
      startDate: "",
      endDate: "",
      dailyItems: DEFAULT_PROGRAM_ITEMS,
    };
  const rows = await db
    .select()
    .from(programSettings)
    .where(eq(programSettings.id, 1))
    .limit(1);
  if (!rows[0])
    return {
      id: 1,
      title: "برنامج عبادتي",
      startDate: "",
      endDate: "",
      dailyItems: DEFAULT_PROGRAM_ITEMS,
    };
  const stored = rows[0];
  const dailyItems = stored.dailyItems.map(item => ({
    ...item,
    choices: item.choices?.length
      ? item.choices
      : (DEFAULT_PROGRAM_ITEMS.find(defaultItem => defaultItem.key === item.key)
          ?.choices ?? []),
  }));
  return { ...stored, dailyItems };
}

export async function saveProgram(input: {
  title: string;
  startDate: string;
  endDate: string;
  dailyItems: ProgramItem[];
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db
    .insert(programSettings)
    .values({ id: 1, ...input })
    .onDuplicateKeyUpdate({ set: { ...input, updatedAt: new Date() } });
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
  return db
    .select({
      userId: users.id,
      loginName: users.name,
      role: users.role,
      displayName: studentProfiles.displayName,
      stage: studentProfiles.stage,
      grade: studentProfiles.grade,
      active: studentProfiles.active,
    })
    .from(users)
    .leftJoin(studentProfiles, eq(studentProfiles.userId, users.id))
    .orderBy(users.id)
    .limit(500);
}

export async function setUserRole(userId: number, role: "user" | "admin") {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const user = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user[0]) return false;
  await db
    .update(users)
    .set({ role, updatedAt: new Date() })
    .where(eq(users.id, userId));
  return true;
}

export async function getAdminLogs(filters: {
  from?: string;
  to?: string;
  userId?: number;
  stage?: ProgramStage;
  grade?: string;
  activity?: string;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions: SQL[] = [];
  if (filters.from) conditions.push(gte(dailyLogs.logDate, filters.from));
  if (filters.to) conditions.push(lte(dailyLogs.logDate, filters.to));
  if (filters.userId) conditions.push(eq(dailyLogs.userId, filters.userId));
  if (filters.stage) conditions.push(eq(studentProfiles.stage, filters.stage));
  if (filters.grade) conditions.push(eq(studentProfiles.grade, filters.grade));
  if (filters.activity)
    conditions.push(
      sql`JSON_CONTAINS_PATH(${dailyLogs.answers}, 'one', ${`$."${filters.activity}"`})`
    );
  const query = db
    .select({
      id: dailyLogs.id,
      userId: dailyLogs.userId,
      logDate: dailyLogs.logDate,
      answers: dailyLogs.answers,
      studentName: studentProfiles.displayName,
      stage: studentProfiles.stage,
      grade: studentProfiles.grade,
    })
    .from(dailyLogs)
    .innerJoin(studentProfiles, eq(dailyLogs.userId, studentProfiles.userId));
  const limit = Math.min(Math.max(filters.limit ?? 3000, 1), 5000);
  return conditions.length
    ? query
        .where(and(...conditions))
        .orderBy(desc(dailyLogs.logDate))
        .limit(limit)
    : query.orderBy(desc(dailyLogs.logDate)).limit(limit);
}
