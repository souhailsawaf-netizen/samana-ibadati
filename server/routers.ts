import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import {
  createSessionToken,
  hasExactStudentRegistrationPasswordLength,
  isValidUsername,
  hashPassword,
  makeLoginAttemptKey,
  normalizeUsername,
  STUDENT_REGISTRATION_PASSWORD_LENGTH,
  verifyPassword,
  AUTH_SESSION_MAX_AGE_MS,
} from "./auth";
import {
  DEFAULT_PROGRAM_ITEMS,
  hasSameChoiceValues,
  isGradeForStage,
  PROGRAM_GRADES,
} from "../shared/program";
import type { ProgramItem } from "../shared/program";
import { dailyStoriesSchema } from "../shared/stories";
import { summarizeFocusActivities } from "../shared/focus-statistics";
import {
  getAdminLogs,
  getAdminInvites,
  getAdminRoster,
  claimStudentInvite,
  createStudentInvite,
  deactivateStudentInvite,
  getDailyLog,
  getProgram,
  getStudentHistory,
  getStudentProfile,
  getUserById,
  getAuthAccountByUserId,
  getAuthAccountByUsername,
  getLoginLockUntil,
  recordSuccessfulRegistration,
  recordFailedLogin,
  clearLoginFailures,
  ensureInitialAdmin,
  createStudentAccount,
  createStudentProfile,
  updateLocalPassword,
  getWeeklyGoal,
  saveDailyAnswers,
  saveProgram,
  saveWeeklyGoal,
  setUserRole,
  updateStudentProfile,
  upsertUser,
} from "./db";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import {
  adminProcedure,
  protectedProcedure,
  publicProcedure,
  router,
} from "./_core/trpc";

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "صيغة التاريخ غير صحيحة")
  .refine(value => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return (
      Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 10) === value
    );
  }, "التاريخ التقويمي غير صحيح");
const stageSchema = z.enum(["primary", "middle"]);
const gradeSchema = z.enum(PROGRAM_GRADES);
const programItemSchema = z.object({
  key: z.string().min(1).max(64),
  title: z.string().min(1).max(100),
  category: z.enum(["worship", "learning", "home"]),
  hint: z.string().max(140),
  response: z.enum(["yesno", "study", "words", "phone"]),
  choices: z
    .array(
      z.object({
        value: z.string().max(32),
        label: z.string().trim().min(1).max(60),
        tone: z.enum(["green", "yellow", "red"]).optional(),
      })
    )
    .min(2)
    .max(6),
  enabled: z.boolean(),
});
const adminReportFiltersSchema = z.object({
  from: dateString.optional(),
  to: dateString.optional(),
  userId: z.number().int().positive().optional(),
  stage: stageSchema.optional(),
  grade: z.string().max(40).optional(),
  activity: z.string().max(64).optional(),
  limit: z.number().int().min(1).max(5000).optional(),
});

function weekStartFor(date: Date) {
  const result = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  const day = result.getUTCDay();
  result.setUTCDate(result.getUTCDate() - ((day + 6) % 7));
  return result.toISOString().slice(0, 10);
}

function programDateNow() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Damascus",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) =>
    parts.find(value => value.type === type)?.value ?? "00";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function isValidAnswer(item: ProgramItem, value: string) {
  return item.choices.some(choice => choice.value === value);
}

const usernameSchema = z
  .string()
  .max(128)
  .refine(
    isValidUsername,
    "استخدم ٣–٣٢ حرفًا عربيًا أو إنجليزيًا، مع أرقام أو _ أو - عند الحاجة."
  )
  .transform(normalizeUsername);
const studentRegistrationPasswordSchema = z
  .string()
  .max(STUDENT_REGISTRATION_PASSWORD_LENGTH * 2)
  .refine(
    hasExactStudentRegistrationPasswordLength,
    "كلمة المرور يجب أن تتكون من ٦ أحرف بالضبط."
  );
const genericLoginError = "اسم المستخدم أو كلمة المرور غير صحيحة، أو أن الحساب مقيد مؤقتًا.";
let dummyPasswordHash: Promise<string> | undefined;

function sessionCookieOptions(req: Parameters<typeof getSessionCookieOptions>[0]) {
  return { ...getSessionCookieOptions(req), maxAge: AUTH_SESSION_MAX_AGE_MS };
}

function publicUser(user: NonNullable<Awaited<ReturnType<typeof getUserById>>>) {
  return { id: user.id, name: user.name, role: user.role };
}

async function requireActiveProfile(userId: number) {
  const profile = await getStudentProfile(userId);
  if (!profile || !profile.active) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "أكمل ملف الطالب أو تواصل مع المشرف لتفعيل المشاركة.",
    });
  }
  return profile;
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(({ ctx }) =>
      ctx.user ? publicUser(ctx.user) : null
    ),
    registerStudent: publicProcedure
      .input(
        z.object({
          username: usernameSchema,
          password: studentRegistrationPasswordSchema,
        })
      )
      .mutation(async ({ ctx, input }) => {
        await ensureInitialAdmin();
        const registrationIp = ctx.req.ip || ctx.req.socket.remoteAddress || "unknown";
        const registrationKey = makeLoginAttemptKey("register", registrationIp);
        const registrationLock = await getLoginLockUntil(registrationKey);
        if (registrationLock && registrationLock.getTime() > Date.now())
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: "توقف التسجيل مؤقتًا؛ حاول مرة أخرى بعد قليل.",
          });
        const result = await createStudentAccount({
          username: normalizeUsername(input.username),
          passwordHash: await hashPassword(input.password),
        });
        if ("error" in result) {
          await recordFailedLogin(registrationKey);
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "اسم المستخدم مستخدم؛ اختر اسمًا آخر.",
          });
        }
        await recordSuccessfulRegistration(registrationKey);
        const account = await getAuthAccountByUserId(result.user.id);
        if (!account) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        const token = await createSessionToken(result.user.id, account.tokenVersion);
        ctx.res.cookie(COOKIE_NAME, token, sessionCookieOptions(ctx.req));
        return publicUser(result.user);
      }),
    login: publicProcedure
      .input(
        z.object({
          username: usernameSchema,
          password: z.string().min(1).max(128),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await ensureInitialAdmin();
        const username = normalizeUsername(input.username);
        const ipAddress = ctx.req.ip || ctx.req.socket.remoteAddress || "unknown";
        const attemptKey = makeLoginAttemptKey(username, ipAddress);
        const ipAttemptKey = makeLoginAttemptKey("login", ipAddress);
        const [lockedUntil, ipLockedUntil] = await Promise.all([
          getLoginLockUntil(attemptKey),
          getLoginLockUntil(ipAttemptKey),
        ]);
        if (
          (lockedUntil && lockedUntil.getTime() > Date.now()) ||
          (ipLockedUntil && ipLockedUntil.getTime() > Date.now())
        ) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: genericLoginError });
        }

        const account = await getAuthAccountByUsername(username);
        dummyPasswordHash ??= hashPassword(randomBytes(32).toString("hex"));
        const passwordMatches = await verifyPassword(
          input.password,
          account?.passwordHash ?? (await dummyPasswordHash)
        );
        if (!account || !passwordMatches) {
          await Promise.all([
            recordFailedLogin(attemptKey),
            recordFailedLogin(ipAttemptKey),
          ]);
          throw new TRPCError({ code: "UNAUTHORIZED", message: genericLoginError });
        }

        const user = await getUserById(account.userId);
        if (!user)
          throw new TRPCError({ code: "UNAUTHORIZED", message: genericLoginError });
        await Promise.all([
          clearLoginFailures(attemptKey),
          clearLoginFailures(ipAttemptKey),
        ]);
        await upsertUser({ openId: user.openId, lastSignedIn: new Date() });
        const token = await createSessionToken(user.id, account.tokenVersion);
        ctx.res.cookie(COOKIE_NAME, token, sessionCookieOptions(ctx.req));
        return publicUser(user);
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    changePassword: protectedProcedure
      .input(
        z.object({
          currentPassword: z.string().min(1).max(128),
          newPassword: z.string().min(10).max(128),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const account = await getAuthAccountByUserId(ctx.user.id);
        if (!account)
          throw new TRPCError({ code: "NOT_FOUND", message: "الحساب غير موجود." });
        if (!(await verifyPassword(input.currentPassword, account.passwordHash)))
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "كلمة المرور الحالية غير صحيحة.",
          });
        if (await verifyPassword(input.newPassword, account.passwordHash))
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "اختر كلمة مرور جديدة مختلفة عن الحالية.",
          });
        const updated = await updateLocalPassword(
          ctx.user.id,
          await hashPassword(input.newPassword)
        );
        if (!updated)
          throw new TRPCError({ code: "NOT_FOUND", message: "الحساب غير موجود." });
        const token = await createSessionToken(
          ctx.user.id,
          account.tokenVersion + 1
        );
        ctx.res.cookie(COOKIE_NAME, token, sessionCookieOptions(ctx.req));
        return { success: true } as const;
      }),
  }),
  student: router({
    dashboard: protectedProcedure.query(async ({ ctx }) => {
      const userId = ctx.user.id;
      const today = programDateNow();
      const weekStart = weekStartFor(new Date(`${today}T12:00:00Z`));
      const [profile, program] = await Promise.all([
        getStudentProfile(userId),
        getProgram(),
      ]);
      if (!profile || !profile.active) {
        return {
          profile,
          program,
          today,
          weekStart,
          todayLog: null,
          recentLogs: [],
          goal: null,
        };
      }
      const [todayLog, recentLogs, goal] = await Promise.all([
        getDailyLog(userId, today),
        getStudentHistory(userId),
        getWeeklyGoal(userId, weekStart),
      ]);
      return { profile, program, today, weekStart, todayLog, recentLogs, goal };
    }),
    createProfile: protectedProcedure
      .input(
        z
          .object({
            displayName: z.string().trim().min(2).max(160),
            stage: stageSchema,
            grade: gradeSchema,
          })
          .refine(
            value => isGradeForStage(value.stage, value.grade),
            "الصف لا يتوافق مع المرحلة"
          )
      )
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "user")
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "إكمال هذا الملف متاح لحسابات الطلاب فقط.",
          });
        const profile = await createStudentProfile({
          userId: ctx.user.id,
          ...input,
        });
        if (!profile)
          throw new TRPCError({
            code: "CONFLICT",
            message: "ملف الطالب موجود بالفعل. حدّث الصفحة للمتابعة.",
          });
        return profile;
      }),
    claimInvite: protectedProcedure
      .input(
        z.object({
          code: z
            .string()
            .trim()
            .toUpperCase()
            .regex(/^[A-F0-9]{12}$/),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const profile = await claimStudentInvite(ctx.user.id, input.code);
        if (!profile)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "رمز الدعوة غير صحيح أو استُخدم من قبل.",
          });
        return profile;
      }),
    saveAnswers: protectedProcedure
      .input(
        z.object({
          logDate: dateString,
          answers: z
            .record(z.string(), z.string())
            .refine(value => Object.keys(value).length <= 30),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await requireActiveProfile(ctx.user.id);
        const program = await getProgram();
        const today = programDateNow();
        if (
          (!program.startDate || !program.endDate) &&
          input.logDate !== today
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "يمكن تسجيل اليوم فقط حتى يحدد المشرف مدة البرنامج.",
          });
        }
        if (
          input.logDate > today ||
          (program.startDate && input.logDate < program.startDate) ||
          (program.endDate && input.logDate > program.endDate)
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "التاريخ خارج مدة البرنامج.",
          });
        }
        const enabledItems = program.dailyItems.filter(item => item.enabled);
        const safeAnswers: Record<string, string> = {};
        for (const item of enabledItems) {
          const value = input.answers[item.key];
          if (value && isValidAnswer(item, value))
            safeAnswers[item.key] = value;
        }
        await saveDailyAnswers(ctx.user.id, input.logDate, safeAnswers);
        return { success: true };
      }),
    saveGoal: protectedProcedure
      .input(
        z.object({
          weekStart: dateString,
          title: z.string().trim().min(2).max(180),
          tasks: z
            .array(
              z.object({
                id: z.string().max(64),
                title: z.string().trim().min(1).max(100),
                done: z.boolean(),
              })
            )
            .min(1)
            .max(7),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await requireActiveProfile(ctx.user.id);
        const today = programDateNow();
        if (input.weekStart !== weekStartFor(new Date(`${today}T12:00:00Z`)))
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "يمكن تعديل هدف الأسبوع الحالي فقط.",
          });
        return saveWeeklyGoal(
          ctx.user.id,
          input.weekStart,
          input.title,
          input.tasks
        );
      }),
    history: protectedProcedure
      .input(
        z
          .object({ from: dateString.optional(), to: dateString.optional() })
          .optional()
      )
      .query(async ({ ctx, input }) => {
        await requireActiveProfile(ctx.user.id);
        return getStudentHistory(ctx.user.id, input?.from, input?.to);
      }),
  }),
  program: router({
    current: protectedProcedure.query(() => getProgram()),
  }),
  admin: router({
    roster: adminProcedure.query(() => getAdminRoster()),
    invites: adminProcedure.query(() => getAdminInvites()),
    createInvite: adminProcedure
      .input(
        z
          .object({
            displayName: z.string().trim().min(2).max(160),
            stage: stageSchema,
            grade: gradeSchema,
          })
          .refine(
            value => isGradeForStage(value.stage, value.grade),
            "الصف لا يتوافق مع المرحلة"
          )
      )
      .mutation(async ({ input }) => {
        const code = randomBytes(6).toString("hex").toUpperCase();
        await createStudentInvite({ ...input, code });
        return { code };
      }),
    deactivateInvite: adminProcedure
      .input(z.object({ inviteId: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        const deactivated = await deactivateStudentInvite(input.inviteId);
        if (!deactivated)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "رمز الدعوة غير موجود.",
          });
        return { success: true };
      }),
    report: adminProcedure
      .input(adminReportFiltersSchema.optional())
      .query(async ({ input }) => {
        if (
          input?.activity &&
          !DEFAULT_PROGRAM_ITEMS.some(item => item.key === input.activity)
        )
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "النشاط غير معروف.",
          });
        const [roster, logs] = await Promise.all([
          getAdminRoster(),
          getAdminLogs(input ?? {}),
        ]);
        return { roster, logs };
      }),
    focusStatistics: adminProcedure
      .input(
        adminReportFiltersSchema.omit({ activity: true }).optional()
      )
      .query(async ({ input }) => {
        const [logs, program] = await Promise.all([
          getAdminLogs(input ?? {}),
          getProgram(),
        ]);
        return summarizeFocusActivities(logs, program.dailyItems);
      }),
    updateStudent: adminProcedure
      .input(
        z
          .object({
            userId: z.number().int().positive(),
            displayName: z.string().trim().min(2).max(160),
            stage: stageSchema,
            grade: gradeSchema,
            active: z.boolean(),
          })
          .refine(
            value => isGradeForStage(value.stage, value.grade),
            "الصف لا يتوافق مع المرحلة"
          )
      )
      .mutation(async ({ input }) => {
        const profile = await updateStudentProfile(input);
        if (!profile)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "حساب الطالب غير موجود.",
          });
        return profile;
      }),
    setRole: adminProcedure
      .input(
        z.object({
          userId: z.number().int().positive(),
          role: z.enum(["user", "admin"]),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (input.userId === ctx.user.id)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "لا يمكن تغيير صلاحية حسابك من هنا.",
          });
        const updated = await setUserRole(input.userId, input.role);
        if (!updated)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "الحساب غير موجود.",
          });
        return { success: true };
      }),
    resetStudentPassword: adminProcedure
      .input(z.object({ userId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.id === input.userId)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "لا يمكن إعادة تعيين كلمة مرور حسابك من هذه الشاشة.",
          });
        const [student, account] = await Promise.all([
          getStudentProfile(input.userId),
          getAuthAccountByUserId(input.userId),
        ]);
        if (!student || !account)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "ملف الطالب غير موجود.",
          });
        const temporaryPassword = randomBytes(12).toString("base64url");
        const updated = await updateLocalPassword(
          input.userId,
          await hashPassword(temporaryPassword)
        );
        if (!updated)
          throw new TRPCError({ code: "NOT_FOUND", message: "حساب الدخول غير موجود." });
        return { temporaryPassword };
      }),
    saveProgram: adminProcedure
      .input(
        z
          .object({
            title: z.string().trim().min(2).max(180),
            startDate: z.union([z.literal(""), dateString]),
            endDate: z.union([z.literal(""), dateString]),
            dailyItems: z.array(programItemSchema).min(1).max(30),
            dailyStories: dailyStoriesSchema,
          })
          .refine(
            value =>
              new Set(value.dailyItems.map(item => item.key)).size ===
              value.dailyItems.length,
            "مفاتيح الأعمال يجب أن تكون فريدة"
          )
          .refine(
            value =>
              value.dailyItems.every(
                item =>
                  new Set(item.choices.map(choice => choice.value)).size ===
                  item.choices.length
              ),
            "قيم خيارات الإجابة يجب أن تكون فريدة"
          )
          .refine(
            value => Boolean(value.startDate) === Boolean(value.endDate),
            "أدخل تاريخي البداية والنهاية معًا"
          )
          .refine(
            value =>
              !value.startDate ||
              !value.endDate ||
              (Date.parse(`${value.endDate}T00:00:00Z`) >=
                Date.parse(`${value.startDate}T00:00:00Z`) &&
                Date.parse(`${value.endDate}T00:00:00Z`) -
                  Date.parse(`${value.startDate}T00:00:00Z`) <=
                  30 * 86400000),
            "مدة البرنامج يجب أن تكون ٣١ يومًا أو أقل"
          )
      )
      .mutation(async ({ input }) => {
        const knownKeys = new Set(DEFAULT_PROGRAM_ITEMS.map(item => item.key));
        if (input.dailyItems.some(item => !knownKeys.has(item.key)))
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "يوجد نشاط غير معروف.",
          });
        if (
          input.dailyItems.some(item => {
            const defaultItem = DEFAULT_PROGRAM_ITEMS.find(
              row => row.key === item.key
            );
            return (
              !defaultItem ||
              item.response !== defaultItem?.response ||
              !hasSameChoiceValues(item.choices, defaultItem.choices)
            );
          })
        )
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "يمكن تعديل نصوص الإجابات وألوانها مع الحفاظ على القيم الداخلية لكل نشاط.",
          });
        return saveProgram(input);
      }),
  }),
});

export type AppRouter = typeof appRouter;
