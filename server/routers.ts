import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import {
  DEFAULT_PROGRAM_ITEMS,
  isGradeForStage,
  PROGRAM_GRADES,
} from "../shared/program";
import type { ProgramItem } from "../shared/program";
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
  getWeeklyGoal,
  saveDailyAnswers,
  saveProgram,
  saveStudentProfile,
  saveWeeklyGoal,
  setUserRole,
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
      })
    )
    .min(2)
    .max(6),
  enabled: z.boolean(),
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
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
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
      .input(
        z
          .object({
            from: dateString.optional(),
            to: dateString.optional(),
            userId: z.number().int().positive().optional(),
            stage: stageSchema.optional(),
            grade: z.string().max(40).optional(),
            activity: z.string().max(64).optional(),
            limit: z.number().int().min(1).max(5000).optional(),
          })
          .optional()
      )
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
      .mutation(({ input }) => saveStudentProfile(input)),
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
    saveProgram: adminProcedure
      .input(
        z
          .object({
            title: z.string().trim().min(2).max(180),
            startDate: z.union([z.literal(""), dateString]),
            endDate: z.union([z.literal(""), dateString]),
            dailyItems: z.array(programItemSchema).min(1).max(30),
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
        const valuesByResponse: Record<ProgramItem["response"], string[]> = {
          yesno: ["done", "missed"],
          study: ["less1", "1h", "2h", "3h"],
          words: ["0", "1", "2", "3"],
          phone: ["under30", "30to60", "over60"],
        };
        if (
          input.dailyItems.some(item => {
            const defaultItem = DEFAULT_PROGRAM_ITEMS.find(
              row => row.key === item.key
            );
            return (
              item.response !== defaultItem?.response ||
              item.choices
                .map(choice => choice.value)
                .sort()
                .join(",") !==
                valuesByResponse[item.response].slice().sort().join(",")
            );
          })
        )
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "يمكن تعديل نصوص الإجابات فقط مع الحفاظ على خيارات كل نشاط.",
          });
        return saveProgram(input);
      }),
  }),
});

export type AppRouter = typeof appRouter;
