import { trpc } from "@/lib/trpc";
import {
  FOCUS_ACTIVITY_KEYS,
  GRADES_BY_STAGE,
  PARENTS_ANSWER_VALUES,
  PHONE_ANSWER_VALUES,
  PROGRAM_GRADES,
  getLegacyAnswerLabel,
  isGradeForStage,
  type AnswerTone,
  type ProgramGrade,
  type ProgramItem,
  type ProgramStage,
} from "../../../shared/program";
import type { DailyStory } from "../../../shared/stories";
import { FocusActivityStatistics } from "@/components/FocusActivityStatistics";
import { StoryEditor } from "@/components/StoryEditor";
import { Download, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export type RosterRow = {
  userId: number;
  loginName: string | null;
  role: "user" | "admin";
  displayName: string | null;
  stage: ProgramStage | null;
  grade: string | null;
  active: boolean | null;
};
type AdminTab = "report" | "stats" | "students" | "settings";
const answerToneOptions: Array<{ value: AnswerTone; label: string }> = [
  { value: "green", label: "أخضر" },
  { value: "yellow", label: "أصفر" },
  { value: "red", label: "أحمر" },
];

function exportCsv(
  rows: Array<{
    logDate: string;
    studentName: string | null;
    stage: ProgramStage | null;
    grade: string | null;
    answers: Record<string, string>;
  }>,
  stageNames: Record<ProgramStage, string>
) {
  const quote = (value: unknown) =>
    `"${String(value ?? "").replaceAll('"', '""')}"`;
  const csv = [
    ["التاريخ", "الطالب", "المرحلة", "الصف", "الإجابات"].map(quote).join(","),
    ...rows.map(row =>
      [
        row.logDate,
        row.studentName,
        row.stage ? stageNames[row.stage] : "",
        row.grade,
        JSON.stringify(row.answers),
      ]
        .map(quote)
        .join(",")
    ),
  ].join("\r\n");
  const url = URL.createObjectURL(
    new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" })
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "تقرير-برنامج-عبادتي.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

function AdminQueryError({
  message,
  onRetry,
  isRetrying,
}: {
  message: string;
  onRetry: () => void;
  isRetrying: boolean;
}) {
  return (
    <div className="query-error">
      <p className="error-box" role="alert">
        {message}
      </p>
      <button
        type="button"
        className="button button-outline button-small"
        onClick={onRetry}
        disabled={isRetrying}
      >
        {isRetrying ? "جارٍ إعادة المحاولة…" : "إعادة المحاولة"}
      </button>
    </div>
  );
}

function StudentInviteManager({
  stageNames,
}: {
  stageNames: Record<ProgramStage, string>;
}) {
  const utils = trpc.useUtils();
  const invitesQuery = trpc.admin.invites.useQuery();
  const [form, setForm] = useState<{
    displayName: string;
    stage: ProgramStage;
    grade: ProgramGrade;
  }>({ displayName: "", stage: "primary", grade: "1" });
  const [latestCode, setLatestCode] = useState("");
  const createInvite = trpc.admin.createInvite.useMutation({
    onSuccess: async result => {
      setLatestCode(result.code);
      setForm(current => ({ ...current, displayName: "" }));
      toast.success("تم إنشاء رمز الدعوة");
      await Promise.all([
        utils.admin.invites.invalidate(),
        utils.admin.roster.invalidate(),
      ]);
    },
    onError: error => toast.error(error.message),
  });
  const deactivateInvite = trpc.admin.deactivateInvite.useMutation({
    onSuccess: () => {
      toast.success("أُلغي رمز الدعوة");
      utils.admin.invites.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const pendingInvites = (invitesQuery.data ?? []).filter(
    invite => invite.active && !invite.claimedByUserId
  );
  return (
    <section className="paper-card card-pad" style={{ marginBottom: "1rem" }}>
      <div className="section-heading" style={{ marginTop: 0 }}>
        <h2>دعوة طالب (اختيارية)</h2>
        <span className="section-count">التسجيل الذاتي متاح أيضًا</span>
      </div>
      <p className="muted">
        التسجيل الذاتي متاح للطلاب. ويمكنك أيضًا إصدار دعوة اختيارية لطالب
        محدّد؛ أدخل اسمه ومرحلته وصفّه وشارك الرمز معه، وسيختار اسم المستخدم
        وكلمة المرور بنفسه.
      </p>
      <form
        className="invite-form"
        onSubmit={event => {
          event.preventDefault();
          createInvite.mutate(form);
        }}
      >
        <div className="field">
          <label htmlFor="invite-display-name">اسم الطالب</label>
          <input
            id="invite-display-name"
            required
            minLength={2}
            value={form.displayName}
            disabled={createInvite.isPending}
            onChange={event =>
              setForm(current => ({
                ...current,
                displayName: event.target.value,
              }))
            }
          />
        </div>
        <div className="field">
          <label htmlFor="invite-stage">المرحلة</label>
          <select
            id="invite-stage"
            value={form.stage}
            disabled={createInvite.isPending}
            onChange={event =>
              setForm(current => ({
                ...current,
                stage: event.target.value as ProgramStage,
                grade: event.target.value === "primary" ? "1" : "7",
              }))
            }
          >
            <option value="primary">ابتدائي</option>
            <option value="middle">إعدادي</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="invite-grade">الصف</label>
          <select
            id="invite-grade"
            value={form.grade}
            disabled={createInvite.isPending}
            onChange={event =>
              setForm(current => ({
                ...current,
                grade: event.target.value as ProgramGrade,
              }))
            }
          >
            {GRADES_BY_STAGE[form.stage].map(grade => (
              <option key={grade} value={grade}>
                {grade}
              </option>
            ))}
          </select>
        </div>
        <button
          className="button button-primary"
          type="submit"
          disabled={createInvite.isPending}
        >
          {createInvite.isPending ? "جارٍ الإنشاء…" : "إنشاء رمز الدعوة"}
        </button>
      </form>
      {latestCode && (
        <div className="invite-code">
          <span>رمز الدعوة الجديد</span>
          <strong dir="ltr">{latestCode}</strong>
          <button
            className="button button-outline button-small"
            onClick={() =>
              navigator.clipboard
                .writeText(latestCode)
                .then(() => toast.success("تم نسخ الرمز"))
                .catch(() => toast.error("تعذر النسخ؛ انسخ الرمز يدويًا"))
            }
          >
            نسخ
          </button>
        </div>
      )}
      <div className="invite-list">
        <strong>دعوات بانتظار الاستخدام ({pendingInvites.length})</strong>
        {pendingInvites.map(invite => (
          <div className="invite-row" key={invite.id}>
            <span>
              {invite.displayName} · {stageNames[invite.stage]} · الصف{" "}
              {invite.grade}
            </span>
            <code dir="ltr">{invite.code}</code>
            <button
              className="button button-danger button-small"
              onClick={() => deactivateInvite.mutate({ inviteId: invite.id })}
              disabled={deactivateInvite.isPending}
            >
              إلغاء
            </button>
          </div>
        ))}
        {invitesQuery.isLoading ? (
          <p className="empty-state" role="status">
            جارٍ تحميل الدعوات…
          </p>
        ) : invitesQuery.error ? (
          <AdminQueryError
            message="تعذّر تحميل الدعوات. حاول مجددًا."
            onRetry={() => void invitesQuery.refetch()}
            isRetrying={invitesQuery.isFetching}
          />
        ) : invitesQuery.isSuccess && pendingInvites.length === 0 ? (
          <p className="muted">لا توجد دعوات معلّقة حاليًا.</p>
        ) : null}
      </div>
    </section>
  );
}

export default function AdminPage({
  roster,
  programItems,
  programStories,
  programTitle,
  startDate,
  endDate,
  setProgramItems,
  setProgramStories,
  setProgramTitle,
  setStartDate,
  setEndDate,
  userId,
  stageNames,
}: {
  roster: RosterRow[];
  programItems: ProgramItem[];
  programStories: DailyStory[];
  programTitle: string;
  startDate: string;
  endDate: string;
  setProgramItems: (items: ProgramItem[]) => void;
  setProgramStories: (stories: DailyStory[]) => void;
  setProgramTitle: (value: string) => void;
  setStartDate: (value: string) => void;
  setEndDate: (value: string) => void;
  userId: number;
  stageNames: Record<ProgramStage, string>;
}) {
  const utils = trpc.useUtils();
  const [tab, setTab] = useState<AdminTab>("report");
  const [filters, setFilters] = useState({
    from: "",
    to: "",
    stage: "all",
    grade: "all",
    userId: "all",
    activity: "all",
  });
  const [selectedStudent, setSelectedStudent] = useState<RosterRow | null>(
    null
  );
  const [studentForm, setStudentForm] = useState({
    displayName: "",
    stage: "primary" as ProgramStage,
    grade: "1",
    active: true,
  });
  const reportFilters = {
    ...(filters.from ? { from: filters.from } : {}),
    ...(filters.to ? { to: filters.to } : {}),
    ...(filters.stage !== "all"
      ? { stage: filters.stage as ProgramStage }
      : {}),
    ...(filters.grade !== "all" ? { grade: filters.grade } : {}),
    ...(filters.userId !== "all" ? { userId: Number(filters.userId) } : {}),
    limit: 5000,
  };
  const reportInput = {
    ...reportFilters,
    ...(filters.activity !== "all" ? { activity: filters.activity } : {}),
  };
  const reportQuery = trpc.admin.report.useQuery(reportInput, {
    enabled: tab === "report",
  });
  const focusStatisticsQuery = trpc.admin.focusStatistics.useQuery(
    reportFilters,
    { enabled: tab === "stats" }
  );
  const updateStudent = trpc.admin.updateStudent.useMutation({
    onSuccess: async (_result, input) => {
      setSelectedStudent(current =>
        current?.userId === input.userId ? { ...current, ...input } : current
      );
      toast.success("تم حفظ بيانات الطالب");
      await Promise.all([
        utils.admin.roster.invalidate(),
        utils.admin.report.invalidate(),
        utils.admin.focusStatistics.invalidate(),
      ]);
    },
    onError: error => toast.error(error.message),
  });
  const setRole = trpc.admin.setRole.useMutation({
    onSuccess: async (_result, input) => {
      setSelectedStudent(current =>
        current?.userId === input.userId
          ? { ...current, role: input.role }
          : current
      );
      toast.success("تم تحديث الصلاحية");
      await utils.admin.roster.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [temporaryPasswordTargetId, setTemporaryPasswordTargetId] = useState<
    number | null
  >(null);
  const resetPassword = trpc.admin.resetStudentPassword.useMutation({
    onSuccess: (result, input) => {
      setTemporaryPassword(result.temporaryPassword);
      setTemporaryPasswordTargetId(input.userId);
      toast.success("أُنشئت كلمة مرور مؤقتة؛ اعرضها للطالب الآن");
    },
    onError: error => toast.error(error.message),
  });
  const saveProgram = trpc.admin.saveProgram.useMutation({
    onSuccess: async () => {
      toast.success("تم تحديث إعدادات البرنامج");
      await utils.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const filteredLogs = reportQuery.data?.logs ?? [];
  const activeProfiles = roster.filter(row => row.active).length;
  const logsDone = filteredLogs.reduce(
    (sum, row) =>
      sum +
      Object.values(row.answers ?? {}).filter(
        value =>
          value === "done" ||
          value === PARENTS_ANSWER_VALUES.satisfactory ||
          value === "1h" ||
          value === "2h" ||
          value === "3h" ||
          value === "3" ||
          value === PHONE_ANSWER_VALUES.under30 ||
          value === PHONE_ANSWER_VALUES.within90 ||
          value === PHONE_ANSWER_VALUES.legacy30to60
      ).length,
    0
  );

  const selectStudent = (row: RosterRow) => {
    setSelectedStudent(row);
    setTemporaryPassword("");
    setTemporaryPasswordTargetId(null);
    setStudentForm({
      displayName: row.displayName ?? row.loginName ?? "",
      stage: row.stage ?? "primary",
      grade: row.grade ?? (row.stage === "middle" ? "7" : "1"),
      active: row.active ?? true,
    });
  };
  const saveStudentData = () => {
    if (!selectedStudent) return;
    const grade = PROGRAM_GRADES.find(value => value === studentForm.grade);
    if (!grade || !isGradeForStage(studentForm.stage, grade)) {
      toast.error("اختر صفًا مناسبًا للمرحلة");
      return;
    }
    updateStudent.mutate({
      userId: selectedStudent.userId,
      ...studentForm,
      grade,
    });
  };
  const saveSettings = () =>
    saveProgram.mutate({
      title: programTitle,
      startDate,
      endDate,
      dailyItems: programItems,
      dailyStories: programStories,
    });
  const issueTemporaryPassword = (userId: number) => {
    setTemporaryPassword("");
    setTemporaryPasswordTargetId(null);
    resetPassword.mutate({ userId });
  };

  return (
    <main className="page-wrap">
      <div className="welcome-row">
        <div>
          <span className="eyebrow">إدارة البرنامج · بيانات الطلاب سرية</span>
          <h1 className="page-title">لوحة إشراف جامع السمانة</h1>
        </div>
        <span className="pill">
          <ShieldCheck size={14} /> صلاحيات المشرف
        </span>
      </div>
      <div className="notice" style={{ marginBottom: "1rem" }}>
        التقارير هنا للمشرفين فقط. كل طالب يرى ملفه وإجاباته وحدها، ولا تظهر له
        صفحات الطلاب الآخرين.
      </div>
      <nav className="tabs" aria-label="أقسام لوحة المشرف">
        {(
          [
            ["report", "الإحصاءات والتقارير"],
            ["stats", "بر الوالدين والجوال"],
            ["students", "الطلاب"],
            ["settings", "إعدادات البرنامج"],
          ] as Array<[AdminTab, string]>
        ).map(([key, label]) => (
          <button
            key={key}
            className={`tab-button ${tab === key ? "active" : ""}`}
            aria-pressed={tab === key}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </nav>
      {tab === "students" && <StudentInviteManager stageNames={stageNames} />}

      {(tab === "report" || tab === "stats") && (
        <>
          {tab === "report" && (
            <section className="overview-grid" style={{ marginBottom: "1rem" }}>
              <div className="paper-card card-pad stats-card">
                <div className="stat-line">
                  <span>حسابات في القائمة</span>
                  <span className="stat-value">{roster.length}</span>
                </div>
                <div className="stat-line">
                  <span>ملفات طلاب مفعّلة</span>
                  <span className="stat-value">{activeProfiles}</span>
                </div>
                <div className="stat-line">
                  <span>إجابات منجزة في النتائج المعروضة</span>
                  <span className="stat-value">
                    {reportQuery.isSuccess ? logsDone : "—"}
                  </span>
                </div>
              </div>
              <div className="paper-card card-pad">
                <span className="eyebrow">ملخص آمن</span>
                <h3 style={{ color: "var(--navy)" }}>
                  تابع التقدّم، لا المقارنة
                </h3>
                <p
                  className="muted"
                  style={{ lineHeight: 1.8, marginBottom: 0 }}
                >
                  تُستخدم الأرقام لمساندة الطلاب وتحسين البرنامج، لا لنشر ترتيب
                  بينهم.
                </p>
              </div>
            </section>
          )}
          <section className="paper-card card-pad">
            <p className="muted" style={{ marginTop: 0, fontSize: ".78rem" }}>
              {tab === "stats"
                ? "تعتمد الإحصاءات على بر الوالدين ووقت الجوال مع مرشحات التاريخ والمرحلة والصف والطالب."
                : "تظهر أحدث ٥٬٠٠٠ إجابة مطابقة للمرشحات."}
            </p>
            <div className="filters">
              <div className="field">
                <label htmlFor="report-date-from">من تاريخ</label>
                <input
                  id="report-date-from"
                  className="filter-control"
                  type="date"
                  value={filters.from}
                  onChange={event =>
                    setFilters(current => ({
                      ...current,
                      from: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="report-date-to">إلى تاريخ</label>
                <input
                  id="report-date-to"
                  className="filter-control"
                  type="date"
                  value={filters.to}
                  onChange={event =>
                    setFilters(current => ({
                      ...current,
                      to: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="report-stage">المرحلة</label>
                <select
                  id="report-stage"
                  className="filter-control"
                  value={filters.stage}
                  onChange={event =>
                    setFilters(current => ({
                      ...current,
                      stage: event.target.value,
                    }))
                  }
                >
                  <option value="all">كل المراحل</option>
                  <option value="primary">ابتدائي</option>
                  <option value="middle">إعدادي</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="report-grade">الصف</label>
                <select
                  id="report-grade"
                  className="filter-control"
                  value={filters.grade}
                  onChange={event =>
                    setFilters(current => ({
                      ...current,
                      grade: event.target.value,
                    }))
                  }
                >
                  <option value="all">كل الصفوف</option>
                  {PROGRAM_GRADES.map(grade => (
                    <option key={grade} value={grade}>
                      الصف {grade}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="report-student">الطالب</label>
                <select
                  id="report-student"
                  className="filter-control"
                  value={filters.userId}
                  onChange={event =>
                    setFilters(current => ({
                      ...current,
                      userId: event.target.value,
                    }))
                  }
                >
                  <option value="all">كل الطلاب</option>
                  {roster
                    .filter(row => row.displayName)
                    .map(row => (
                      <option key={row.userId} value={row.userId}>
                        {row.displayName}
                      </option>
                    ))}
                </select>
              </div>
              {tab === "report" && (
                <button
                  className="button button-outline"
                  onClick={() => exportCsv(filteredLogs, stageNames)}
                  disabled={!reportQuery.isSuccess || reportQuery.isFetching}
                >
                  <Download size={16} /> CSV
                </button>
              )}
            </div>
            {tab === "report" && (
              <div
                className="field"
                style={{ maxWidth: 320, marginTop: ".5rem" }}
              >
                <label htmlFor="report-activity">تصفية حسب العمل المسجّل</label>
                <select
                  id="report-activity"
                  className="filter-control"
                  value={filters.activity}
                  onChange={event =>
                    setFilters(current => ({
                      ...current,
                      activity: event.target.value,
                    }))
                  }
                >
                  <option value="all">كل الأعمال</option>
                  {programItems.map(item => (
                    <option key={item.key} value={item.key}>
                      {item.title}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {tab === "stats" ? (
              focusStatisticsQuery.isFetching ? (
                <p className="empty-state" role="status">
                  جارٍ تجهيز الإحصاءات…
                </p>
              ) : focusStatisticsQuery.error ? (
                <AdminQueryError
                  message="تعذّر تحميل الإحصاءات. حاول مجددًا."
                  onRetry={() => void focusStatisticsQuery.refetch()}
                  isRetrying={focusStatisticsQuery.isFetching}
                />
              ) : focusStatisticsQuery.data ? (
                <FocusActivityStatistics
                  statistics={focusStatisticsQuery.data}
                />
              ) : (
                <p className="empty-state" role="status">
                  لا توجد بيانات للإحصاءات بعد.
                </p>
              )
            ) : reportQuery.isFetching ? (
              <p className="empty-state" role="status">
                جارٍ تحميل التقرير…
              </p>
            ) : reportQuery.error ? (
              <AdminQueryError
                message="تعذّر تحميل التقرير. حاول مجددًا."
                onRetry={() => void reportQuery.refetch()}
                isRetrying={reportQuery.isFetching}
              />
            ) : reportQuery.isSuccess && filteredLogs.length > 0 ? (
              <div className="table-wrap">
                <table aria-label="تقرير إجابات الطلاب">
                  <thead>
                    <tr>
                      <th scope="col">التاريخ</th>
                      <th scope="col">الطالب</th>
                      <th scope="col">المرحلة / الصف</th>
                      <th scope="col">الأعمال المسجلة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.map(row => (
                      <tr key={row.id}>
                        <td>{row.logDate}</td>
                        <td>{row.studentName ?? "—"}</td>
                        <td>
                          {row.stage
                            ? `${stageNames[row.stage]} · ${row.grade ?? ""}`
                            : "—"}
                        </td>
                        <td>
                          {Object.entries(row.answers ?? {}).map(
                            ([key, value]) => {
                              const item = programItems.find(
                                entry => entry.key === key
                              );
                              return (
                                <span
                                  className="pill"
                                  key={key}
                                  style={{ margin: "0 .15rem .2rem" }}
                                >
                                  {item?.title ?? key}:{" "}
                                  {answerText(value, item)}
                                </span>
                              );
                            }
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : reportQuery.isSuccess ? (
              <p className="empty-state" role="status">
                لا توجد إجابات مطابقة للمرشّحات بعد.
              </p>
            ) : null}
          </section>
        </>
      )}

      {tab === "students" && (
        <div className="goal-layout">
          <section className="paper-card card-pad">
            <div className="section-heading" style={{ marginTop: 0 }}>
              <h2>حسابات الطلاب</h2>
              <span className="section-count">
                تظهر هنا الحسابات التي دخلت إلى التطبيق
              </span>
            </div>
            <div className="notice" style={{ marginBottom: ".8rem" }}>
              التسجيل الذاتي مفتوح؛ تظهر الحسابات هنا بعد إنشاء الطالب لحسابه
              وإكمال ملفه. ويمكنك استخدام الدعوة الاختيارية أعلاه لتنظيم تسجيل
              طالب معيّن.
            </div>
            <div className="table-wrap">
              <table aria-label="حسابات الطلاب">
                <thead>
                  <tr>
                    <th scope="col">الاسم</th>
                    <th scope="col">المرحلة والصف</th>
                    <th scope="col">الحالة</th>
                    <th scope="col">الصلاحية</th>
                  </tr>
                </thead>
                <tbody>
                  {roster.map(row => (
                    <tr
                      key={row.userId}
                      aria-selected={selectedStudent?.userId === row.userId}
                      style={{
                        background:
                          selectedStudent?.userId === row.userId
                            ? "#fff8df"
                            : "",
                      }}
                    >
                      <td>
                        <button
                          type="button"
                          className="admin-student-select"
                          aria-pressed={selectedStudent?.userId === row.userId}
                          onClick={() => selectStudent(row)}
                          disabled={
                            updateStudent.isPending ||
                            setRole.isPending ||
                            resetPassword.isPending
                          }
                        >
                          {row.displayName ??
                            row.loginName ??
                            `حساب ${row.userId}`}
                        </button>
                      </td>
                      <td>
                        {row.stage
                          ? `${stageNames[row.stage]} · ${row.grade}`
                          : "لم يُكمل الملف"}
                      </td>
                      <td>
                        {row.active
                          ? "مفعّل"
                          : row.active === false
                            ? "موقوف"
                            : "بانتظار الملف"}
                      </td>
                      <td>{row.role === "admin" ? "مشرف" : "طالب"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {roster.length === 0 && (
                <p className="empty-state">لا توجد حسابات بعد.</p>
              )}
            </div>
          </section>
          <section className="paper-card card-pad">
            <h2 style={{ color: "var(--navy)", marginTop: 0 }}>
              {selectedStudent ? "تعديل ملف الطالب" : "اختر طالبًا"}
            </h2>
            {selectedStudent ? (
              <>
                <div className="field">
                  <label htmlFor="student-display-name">الاسم المعروض</label>
                  <input
                    id="student-display-name"
                    value={studentForm.displayName}
                    disabled={updateStudent.isPending}
                    onChange={event =>
                      setStudentForm(current => ({
                        ...current,
                        displayName: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="field">
                  <label htmlFor="student-stage">المرحلة</label>
                  <select
                    id="student-stage"
                    value={studentForm.stage}
                    disabled={updateStudent.isPending}
                    onChange={event =>
                      setStudentForm(current => ({
                        ...current,
                        stage: event.target.value as ProgramStage,
                        grade: event.target.value === "primary" ? "1" : "7",
                      }))
                    }
                  >
                    <option value="primary">ابتدائي</option>
                    <option value="middle">إعدادي</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="student-grade">الصف</label>
                  <select
                    id="student-grade"
                    value={studentForm.grade}
                    disabled={updateStudent.isPending}
                    onChange={event =>
                      setStudentForm(current => ({
                        ...current,
                        grade: event.target.value,
                      }))
                    }
                  >
                    {GRADES_BY_STAGE[studentForm.stage].map(grade => (
                      <option key={grade} value={grade}>
                        {grade}
                      </option>
                    ))}
                  </select>
                </div>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: ".5rem",
                    margin: "0 0 1rem",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={studentForm.active}
                    aria-label="حالة ملف الطالب"
                    disabled={updateStudent.isPending}
                    onChange={event =>
                      setStudentForm(current => ({
                        ...current,
                        active: event.target.checked,
                      }))
                    }
                  />{" "}
                  مشاركة الطالب مفعّلة
                </label>
                <button
                  className="button button-primary"
                  onClick={saveStudentData}
                  disabled={updateStudent.isPending}
                >
                  حفظ بيانات الطالب
                </button>
                <hr
                  style={{
                    border: 0,
                    borderTop: "1px solid var(--border)",
                    margin: "1.2rem 0",
                  }}
                />
                <div className="field">
                  <label htmlFor="student-role">صلاحية الحساب</label>
                  <select
                    id="student-role"
                    value={selectedStudent.role}
                    disabled={
                      selectedStudent.userId === userId || setRole.isPending
                    }
                    onChange={event =>
                      setRole.mutate({
                        userId: selectedStudent.userId,
                        role: event.target.value as "user" | "admin",
                      })
                    }
                  >
                    <option value="user">طالب</option>
                    <option value="admin">مشرف</option>
                  </select>
                </div>
                <p className="muted" style={{ fontSize: ".78rem" }}>
                  لا يمكن تغيير صلاحية حساب المشرف الحالي من هنا.
                </p>
                {selectedStudent.role !== "admin" && (
                  <>
                    <button
                      className="button button-outline"
                      onClick={() =>
                        issueTemporaryPassword(selectedStudent.userId)
                      }
                      disabled={resetPassword.isPending}
                    >
                      {resetPassword.isPending
                        ? "جارٍ الإنشاء…"
                        : "إصدار كلمة مرور مؤقتة للطالب"}
                    </button>
                    {temporaryPassword &&
                      temporaryPasswordTargetId === selectedStudent.userId && (
                        <div className="invite-code" role="status">
                          <span>كلمة المرور المؤقتة — تظهر مرة واحدة فقط</span>
                          <strong dir="ltr">{temporaryPassword}</strong>
                          <button
                            className="button button-outline button-small"
                            onClick={() =>
                              navigator.clipboard
                                .writeText(temporaryPassword)
                                .then(() => toast.success("تم نسخ كلمة المرور"))
                                .catch(() => toast.error("انسخها يدويًا"))
                            }
                          >
                            نسخ
                          </button>
                          <p className="muted" style={{ margin: 0 }}>
                            شاركها مع الطالب بأمان. بعد مغادرة هذه الصفحة لن
                            تظهر مجددًا.
                          </p>
                        </div>
                      )}
                  </>
                )}
              </>
            ) : (
              <p className="muted">اختر اسمًا من القائمة لإدارة ملفه.</p>
            )}
          </section>
        </div>
      )}

      {tab === "settings" && (
        <section className="paper-card card-pad">
          <div className="section-heading" style={{ marginTop: 0 }}>
            <h2>إعدادات الشهر والأعمال اليومية</h2>
            <span className="section-count">التغييرات تسري على الجميع</span>
          </div>
          <div className="goal-layout">
            <div>
              <div className="field">
                <label htmlFor="program-title">اسم البرنامج</label>
                <input
                  id="program-title"
                  value={programTitle}
                  disabled={saveProgram.isPending}
                  onChange={event => setProgramTitle(event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="program-start-date">تاريخ البداية</label>
                <input
                  id="program-start-date"
                  type="date"
                  value={startDate}
                  disabled={saveProgram.isPending}
                  onChange={event => setStartDate(event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="program-end-date">تاريخ النهاية</label>
                <input
                  id="program-end-date"
                  type="date"
                  value={endDate}
                  disabled={saveProgram.isPending}
                  onChange={event => setEndDate(event.target.value)}
                />
              </div>
              <button
                className="button button-primary"
                onClick={saveSettings}
                disabled={saveProgram.isPending}
              >
                حفظ إعدادات البرنامج
              </button>
            </div>
            <div>
              <p className="muted">
                عدّل نص السؤال وإرشاده وخيارات الإجابة، ولون خيارات بر الوالدين
                والجوال، أو أخفِ النشاط. اضغط حفظ إعدادات البرنامج لتطبيق
                التغييرات على الجميع. تبقى إجابات الطلاب والقيم الداخلية كما هي.
              </p>
              {programItems.map((item, index) => (
                <div
                  key={item.key}
                  style={{
                    padding: ".35rem 0",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <div className="task-edit-row">
                    <input
                      type="checkbox"
                      className="inline-check"
                      checked={item.enabled}
                      aria-label={`إظهار ${item.title}`}
                      disabled={saveProgram.isPending}
                      onChange={event =>
                        setProgramItems(
                          programItems.map((row, rowIndex) =>
                            rowIndex === index
                              ? { ...row, enabled: event.target.checked }
                              : row
                          )
                        )
                      }
                    />
                    <input
                      type="text"
                      value={item.title}
                      aria-label={`عنوان النشاط ${item.title}`}
                      maxLength={100}
                      disabled={saveProgram.isPending}
                      onChange={event =>
                        setProgramItems(
                          programItems.map((row, rowIndex) =>
                            rowIndex === index
                              ? { ...row, title: event.target.value }
                              : row
                          )
                        )
                      }
                    />
                  </div>
                  <input
                    className="filter-control"
                    aria-label={`إرشاد ${item.title}`}
                    value={item.hint}
                    maxLength={140}
                    disabled={saveProgram.isPending}
                    onChange={event =>
                      setProgramItems(
                        programItems.map((row, rowIndex) =>
                          rowIndex === index
                            ? { ...row, hint: event.target.value }
                            : row
                        )
                      )
                    }
                  />
                  <details className="choice-editor">
                    <summary>
                      تعديل نص خيارات الإجابة وألوانها عند توفرها
                    </summary>
                    {item.choices.map((choice, choiceIndex) => (
                      <div
                        className="task-edit-row choice-edit-row"
                        key={choice.value}
                      >
                        <span className="pill">{choice.value}</span>
                        <input
                          aria-label={`نص الخيار ${choiceIndex + 1} لـ${item.title}`}
                          value={choice.label}
                          maxLength={60}
                          disabled={saveProgram.isPending}
                          onChange={event =>
                            setProgramItems(
                              programItems.map((row, rowIndex) =>
                                rowIndex === index
                                  ? {
                                      ...row,
                                      choices: row.choices.map(
                                        (option, optionIndex) =>
                                          optionIndex === choiceIndex
                                            ? {
                                                ...option,
                                                label: event.target.value,
                                              }
                                            : option
                                      ),
                                    }
                                  : row
                              )
                            )
                          }
                        />
                        {(item.key === FOCUS_ACTIVITY_KEYS.parents ||
                          item.key === FOCUS_ACTIVITY_KEYS.phone) && (
                          <label className="choice-tone-editor">
                            <span
                              className={`answer-indicator ${choice.tone ?? "unanswered"}`}
                              aria-hidden="true"
                            />
                            <span>لون الإجابة</span>
                            <select
                              aria-label={`لون الخيار ${choiceIndex + 1} لـ${item.title}`}
                              value={choice.tone ?? "green"}
                              disabled={saveProgram.isPending}
                              onChange={event =>
                                setProgramItems(
                                  programItems.map((row, rowIndex) =>
                                    rowIndex === index
                                      ? {
                                          ...row,
                                          choices: row.choices.map(
                                            (option, optionIndex) =>
                                              optionIndex === choiceIndex
                                                ? {
                                                    ...option,
                                                    tone: event.target
                                                      .value as AnswerTone,
                                                  }
                                                : option
                                          ),
                                        }
                                      : row
                                  )
                                )
                              }
                            >
                              {answerToneOptions.map(option => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>
                        )}
                      </div>
                    ))}
                  </details>
                </div>
              ))}
              <StoryEditor
                stories={programStories}
                disabled={saveProgram.isPending}
                onChange={setProgramStories}
              />
            </div>
          </div>
        </section>
      )}
    </main>
  );
}

function answerText(value: string, item?: ProgramItem) {
  const legacyLabel = getLegacyAnswerLabel(item?.key ?? "", value);
  if (legacyLabel) return legacyLabel;
  const configuredLabel = item?.choices.find(
    choice => choice.value === value
  )?.label;
  if (configuredLabel) return configuredLabel;
  const labels: Record<string, string> = {
    done: "أنجزت",
    missed: "لم أنجز",
    less1: "أقل من ساعة",
    "1h": "ساعة",
    "2h": "ساعتان",
    "3h": "٣ ساعات فأكثر",
    "0": "٠ كلمات",
    "1": "كلمة واحدة",
    "2": "كلمتان",
    "3": "٣ كلمات",
    under30: "٣٠ دقيقة وأقل",
    "31to90": "٣١–٩٠ دقيقة",
    over90: "أكثر من ٩٠ دقيقة",
  };
  return labels[value] ?? value;
}
