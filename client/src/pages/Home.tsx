import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import {
  CATEGORY_LABELS,
  DEFAULT_PROGRAM_ITEMS,
  GRADES_BY_STAGE,
  PROGRAM_GRADES,
  getAnswerIndicator,
  isGradeForStage,
  type ProgramGrade,
  type ProgramItem,
  type ProgramStage,
} from "../../../shared/program";
import { DAILY_STORIES } from "../../../shared/stories";
import {
  BookOpen,
  Check,
  Download,
  KeyRound,
  LogOut,
  MoonStar,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { toast } from "sonner";

type View = "student" | "admin";
type AdminTab = "report" | "students" | "settings";
type Answers = Record<string, string>;
type RosterRow = {
  userId: number;
  loginName: string | null;
  role: "user" | "admin";
  displayName: string | null;
  stage: ProgramStage | null;
  grade: string | null;
  active: boolean | null;
};

const stageNames: Record<ProgramStage, string> = {
  primary: "ابتدائي",
  middle: "إعدادي",
};

function readableDate(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  return new Intl.DateTimeFormat("ar", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}
function isComplete(item: ProgramItem, value?: string) {
  if (item.response === "yesno") return value === "done";
  if (item.response === "study")
    return ["1h", "2h", "3h"].includes(value ?? "");
  if (item.response === "words") return value === "3";
  return value === "30to60";
}
function getDoneCount(items: ProgramItem[], answers: Answers) {
  return items.filter(
    item => item.enabled && isComplete(item, answers[item.key])
  ).length;
}
function percent(part: number, total: number) {
  return total ? Math.round((part / total) * 100) : 0;
}
function exportCsv(
  rows: Array<{
    logDate: string;
    studentName: string | null;
    stage: ProgramStage | null;
    grade: string | null;
    answers: Answers;
  }>
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

function Brand() {
  return (
    <div className="brand-lockup">
      <div className="brand-mark">
        <img src="/brand-mark.svg" alt="" />
      </div>
      <div>
        <p className="brand-title">برنامج عبادتي</p>
        <div className="brand-subtitle">جامع السمانة · خطوة جميلة كل يوم</div>
      </div>
    </div>
  );
}

function Header({
  userName,
  isAdmin,
  view,
  setView,
  logout,
}: {
  userName: string;
  isAdmin: boolean;
  view: View;
  setView: (view: View) => void;
  logout: () => void;
}) {
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const changePassword = trpc.auth.changePassword.useMutation({
    onSuccess: () => {
      toast.success("تم تحديث كلمة المرور");
      setPasswordDialogOpen(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: error => toast.error(error.message),
  });
  const submitPasswordChange = (event: FormEvent) => {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("تأكد من تطابق كلمتي المرور الجديدتين");
      return;
    }
    changePassword.mutate({ currentPassword, newPassword });
  };

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Brand />
          <div className="topbar-actions">
            {isAdmin && (
              <button
                className="button button-secondary"
                onClick={() => setView(view === "admin" ? "student" : "admin")}
              >
                <ShieldCheck size={17} />
                {view === "admin" ? "واجهة الطالب" : "لوحة المشرف"}
              </button>
            )}
            <span className="brand-subtitle">{userName}</span>
            <button
              className="button button-secondary"
              onClick={() => setPasswordDialogOpen(true)}
            >
              <KeyRound size={17} />
              <span className="desktop-label">كلمة المرور</span>
            </button>
            <button
              className="button button-secondary"
              onClick={logout}
              aria-label="تسجيل الخروج"
            >
              <LogOut size={17} />
              <span className="desktop-label">خروج</span>
            </button>
          </div>
        </div>
      </header>
      {passwordDialogOpen && (
        <div
          className="change-password-overlay"
          role="presentation"
          onMouseDown={event => {
            if (event.target === event.currentTarget)
              setPasswordDialogOpen(false);
          }}
        >
          <section
            className="paper-card change-password-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="change-password-title"
          >
            <button
              type="button"
              className="dialog-close"
              aria-label="إغلاق"
              onClick={() => setPasswordDialogOpen(false)}
            >
              ×
            </button>
            <span className="eyebrow">أمان الحساب</span>
            <h2 id="change-password-title">تغيير كلمة المرور</h2>
            <p className="muted">اختر كلمة مرور من ١٠ أحرف على الأقل.</p>
            <form className="login-form" onSubmit={submitPasswordChange}>
              <label htmlFor="current-password">كلمة المرور الحالية</label>
              <input
                id="current-password"
                type="password"
                autoComplete="current-password"
                minLength={1}
                maxLength={128}
                required
                value={currentPassword}
                onChange={event => setCurrentPassword(event.target.value)}
              />
              <label htmlFor="new-password">كلمة المرور الجديدة</label>
              <input
                id="new-password"
                type="password"
                autoComplete="new-password"
                minLength={10}
                maxLength={128}
                required
                value={newPassword}
                onChange={event => setNewPassword(event.target.value)}
              />
              <label htmlFor="confirm-password">تأكيد كلمة المرور الجديدة</label>
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                minLength={10}
                maxLength={128}
                required
                value={confirmPassword}
                onChange={event => setConfirmPassword(event.target.value)}
              />
              <button
                className="button button-primary"
                type="submit"
                disabled={changePassword.isPending}
              >
                {changePassword.isPending ? "جارٍ التحديث…" : "حفظ كلمة المرور"}
              </button>
            </form>
          </section>
        </div>
      )}
    </>
  );
}

function ProfileSetup({
  name,
  onSave,
  pending,
}: {
  name: string;
  onSave: (value: {
    displayName: string;
    stage: ProgramStage;
    grade: ProgramGrade;
  }) => void;
  pending: boolean;
}) {
  const [displayName, setDisplayName] = useState("");
  const [stage, setStage] = useState<ProgramStage>("primary");
  const [grade, setGrade] = useState<ProgramGrade>("1");
  return (
    <div className="page-wrap">
      <div className="paper-card card-pad profile-form">
        <span className="eyebrow">خطوة واحدة للبدء</span>
        <h1 className="page-title">أكمل ملف الطالب</h1>
        <p className="muted">
          مرحبًا {name || "بك"}. اختر اسمك المعروض ومرحلتك وصفك؛ هذه المعلومات
          تساعد المشرف على تنظيم البرنامج، ولا يراها الطلاب الآخرون.
        </p>
        <form
          onSubmit={event => {
            event.preventDefault();
            onSave({ displayName: displayName.trim(), stage, grade });
          }}
        >
          <div className="field">
            <label htmlFor="student-display-name">الاسم الذي سيظهر في البرنامج</label>
            <input
              id="student-display-name"
              required
              minLength={2}
              maxLength={160}
              autoComplete="name"
              value={displayName}
              onChange={event => setDisplayName(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="student-stage">المرحلة الدراسية</label>
            <select
              id="student-stage"
              value={stage}
              onChange={event => {
                const nextStage = event.target.value as ProgramStage;
                setStage(nextStage);
                setGrade(GRADES_BY_STAGE[nextStage][0]);
              }}
            >
              <option value="primary">ابتدائي</option>
              <option value="middle">إعدادي</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="student-grade">الصف</label>
            <select
              id="student-grade"
              value={grade}
              onChange={event => setGrade(event.target.value as ProgramGrade)}
            >
              {GRADES_BY_STAGE[stage].map(value => (
                <option key={value} value={value}>الصف {value}</option>
              ))}
            </select>
          </div>
          <button
            className="button button-primary"
            type="submit"
            disabled={pending}
          >
            {pending ? "جارٍ حفظ الملف…" : "ابدأ برنامجك"}
          </button>
        </form>
      </div>
    </div>
  );
}

function StudentPage({
  dashboard,
  userName,
}: {
  dashboard: NonNullable<ReturnType<typeof useStudentQuery>["data"]>;
  userName: string;
}) {
  const utils = trpc.useUtils();
  const profileMutation = trpc.student.createProfile.useMutation({
    onSuccess: () => {
      toast.success("اكتمل ملفك، أهلًا بك في البرنامج!");
      utils.student.dashboard.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const answersMutation = trpc.student.saveAnswers.useMutation({
    onSuccess: () => {
      toast.success("تم حفظ يومك، أحسنت!");
      utils.student.dashboard.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const goalMutation = trpc.student.saveGoal.useMutation({
    onSuccess: () => {
      toast.success("حُفظ هدفك الأسبوعي");
      utils.student.dashboard.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const [answers, setAnswers] = useState<Answers>({});
  const [goalTitle, setGoalTitle] = useState("");
  const [goalTasks, setGoalTasks] = useState<
    Array<{ id: string; title: string; done: boolean }>
  >([]);
  const [newTask, setNewTask] = useState("");
  const items = dashboard.program.dailyItems?.length
    ? dashboard.program.dailyItems
    : DEFAULT_PROGRAM_ITEMS;
  const enabledItems = items.filter(item => item.enabled);
  const completedCount = getDoneCount(items, answers);
  const completionPercent = percent(completedCount, enabledItems.length);
  const storyAnchor =
    dashboard.program.startDate || `${dashboard.today.slice(0, 8)}01`;
  const storyOffset = Math.max(
    0,
    Math.floor(
      (Date.parse(`${dashboard.today}T12:00:00Z`) -
        Date.parse(`${storyAnchor}T12:00:00Z`)) /
        86400000
    )
  );
  const storyNumber = storyOffset + 1;
  const story = DAILY_STORIES[storyOffset % DAILY_STORIES.length];

  useEffect(() => {
    setAnswers(dashboard.todayLog?.answers ?? {});
  }, [dashboard.todayLog?.id, dashboard.todayLog?.updatedAt]);
  useEffect(() => {
    setGoalTitle(dashboard.goal?.title ?? "");
    setGoalTasks(dashboard.goal?.tasks ?? []);
  }, [dashboard.goal?.id, dashboard.goal?.updatedAt]);

  const answerCounts = useMemo(
    () =>
      dashboard.recentLogs.map(log => ({
        date: log.logDate,
        done: getDoneCount(items, log.answers ?? {}),
        total: items.filter(item => item.enabled).length,
      })),
    [dashboard.recentLogs, items]
  );
  const totalAnswered = dashboard.recentLogs.reduce(
    (sum, row) => sum + Object.keys(row.answers ?? {}).length,
    0
  );
  const totalDone = dashboard.recentLogs.reduce(
    (sum, row) => sum + getDoneCount(items, row.answers ?? {}),
    0
  );

  if (dashboard.profile && !dashboard.profile.active)
    return (
      <main className="page-wrap">
        <section className="paper-card card-pad">
          <span className="eyebrow">مشاركة البرنامج</span>
          <h1 className="page-title">تواصل مع المشرف</h1>
          <p className="muted">
            مشاركتك في البرنامج متوقفة حاليًا. يمكن لمشرف جامع السمانة مساعدتك
            على تفعيلها.
          </p>
        </section>
      </main>
    );
  if (!dashboard.profile)
    return (
      <ProfileSetup
        name={userName || ""}
        pending={profileMutation.isPending}
        onSave={value => profileMutation.mutate(value)}
      />
    );

  const saveAnswers = () =>
    answersMutation.mutate({ logDate: dashboard.today, answers });
  const changeAnswer = (key: string, value: string) =>
    setAnswers(current => ({ ...current, [key]: value }));
  const saveGoal = () => {
    if (goalTitle.trim().length < 2 || goalTasks.length === 0) {
      toast.error("اكتب هدفًا وأضف خطوة واحدة على الأقل");
      return;
    }
    goalMutation.mutate({
      weekStart: dashboard.weekStart,
      title: goalTitle.trim(),
      tasks: goalTasks,
    });
  };
  const addGoalTask = () => {
    const value = newTask.trim();
    if (!value || goalTasks.length >= 7) return;
    setGoalTasks(current => [
      ...current,
      { id: crypto.randomUUID(), title: value, done: false },
    ]);
    setNewTask("");
  };

  return (
    <main className="page-wrap">
      <div className="welcome-row">
        <div>
          <span className="eyebrow">
            {dashboard.program.title} · {readableDate(dashboard.today)}
          </span>
          <h1 className="page-title">
            أهلًا {dashboard.profile.displayName}، كيف كان يومك؟
          </h1>
        </div>
        <span className="pill">
          {stageNames[dashboard.profile.stage]} · الصف {dashboard.profile.grade}
        </span>
      </div>
      <section className="overview-grid" aria-label="ملخص التقدم">
        <div className="paper-card hero-card">
          <div className="hero-content">
            <span className="eyebrow" style={{ color: "#f2c94c" }}>
              بخطوات صغيرة نصنع عادات جميلة
            </span>
            <h2 className="hero-title">متابعتك اليوم</h2>
            <p className="hero-note">
              سجّل ما أنجزته بصدق وهدوء. كل خطوة طيبة لها أثر، ولا تظهر يومياتك
              للطلاب الآخرين.
            </p>
          </div>
          <div
            className="progress-ring"
            style={
              { "--progress": `${completionPercent * 3.6}deg` } as CSSProperties
            }
          >
            <strong>{completionPercent}٪</strong>
          </div>
        </div>
        <div className="paper-card card-pad stats-card">
          <div className="stat-line">
            <span>أنجزت اليوم</span>
            <span className="stat-value">
              {completedCount} من {enabledItems.length}
            </span>
          </div>
          <div className="stat-line">
            <span>خطوات هدف الأسبوع</span>
            <span className="stat-value">
              {goalTasks.filter(task => task.done).length} من {goalTasks.length}
            </span>
          </div>
          <div className="stat-line">
            <span>إنجازات الأيام المسجلة</span>
            <span className="stat-value">
              {totalDone} من {totalAnswered}
            </span>
          </div>
        </div>
      </section>

      {enabledItems.some(item => item.key === "story") && (
        <section className="paper-card story-card">
          <div className="story-label">
            <BookOpen size={17} /> قصة اليوم <span>الحكاية {storyNumber}</span>
          </div>
          <h2>{story.title}</h2>
          <p>{story.body}</p>
          <div className="story-takeaway">
            <Sparkles size={16} /> {story.takeaway}
          </div>
          <p className="story-note">حكاية تربوية قصيرة من نسج الخيال.</p>
          <button
            className={`button ${answers.story === "done" ? "button-outline" : "button-primary"}`}
            onClick={() => changeAnswer("story", "done")}
          >
            {answers.story === "done" ? "تم تسجيل قراءة القصة ✓" : "قرأت القصة"}
          </button>
        </section>
      )}
      <div className="section-heading">
        <h2>أعمال اليوم</h2>
        <span className="section-count">اختَر إجابة لكل عمل ثم احفظ</span>
      </div>
      {(["worship", "learning", "home"] as const).map(category => {
        const sectionItems = enabledItems.filter(
          item => item.category === category
        );
        if (!sectionItems.length) return null;
        return (
          <section key={category}>
            <h3 className="category-title">
              {category === "worship" ? (
                <MoonStar size={18} />
              ) : category === "learning" ? (
                <BookOpen size={18} />
              ) : (
                <Users size={18} />
              )}
              {CATEGORY_LABELS[category]}
            </h3>
            <div className="task-list">
              {sectionItems.map(item => {
                const indicator = getAnswerIndicator(item.key, answers[item.key]);
                const hasIndicator = item.key === "parents" || item.key === "phone";
                return (
                  <article
                    key={item.key}
                    className={`task-row ${isComplete(item, answers[item.key]) ? "done" : ""}`}
                  >
                    <div className="task-copy">
                      <div className="task-title-row">
                        <p className="task-name">{item.title}</p>
                        {hasIndicator && (
                          <span
                            className={`answer-indicator ${indicator?.tone ?? "unanswered"}`}
                            role="img"
                            aria-label={indicator?.label ?? "لم يتم اختيار إجابة"}
                            title={indicator?.label ?? "لم يتم اختيار إجابة"}
                          />
                        )}
                      </div>
                      <span className="task-hint">{item.hint}</span>
                    </div>
                    <div className="task-controls">
                      {item.response === "yesno" ? (
                        item.choices.map(choice => (
                          <button
                            key={choice.value}
                            className={`choice-btn ${answers[item.key] === choice.value ? (choice.value === "done" ? "active-yes" : "active-no") : ""}`}
                            onClick={() => changeAnswer(item.key, choice.value)}
                          >
                            {choice.value === "done" && <Check size={15} />} {" "}
                            {choice.label}
                          </button>
                        ))
                      ) : (
                        <select
                          aria-label={`الإجابة عن ${item.title}`}
                          className="choice-select"
                          value={answers[item.key] ?? ""}
                          onChange={event =>
                            changeAnswer(item.key, event.target.value)
                          }
                        >
                          <option value="">اختر الإجابة</option>
                          {item.choices.map(option => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
      <div className="section-heading">
        <h2>هدفك لهذا الأسبوع</h2>
        <span className="section-count">أنت تختار الهدف وخطواته</span>
      </div>
      <section className="goal-layout">
        <div className="paper-card card-pad">
          <div className="field">
            <label htmlFor="weekly-goal">
              ما الهدف الذي تريد تحقيقه هذا الأسبوع؟
            </label>
            <input
              id="weekly-goal"
              value={goalTitle}
              onChange={event => setGoalTitle(event.target.value)}
              maxLength={180}
              placeholder="مثال: أقرأ كل يوم قبل النوم"
            />
          </div>
          <div className="field">
            <label>خطوات صغيرة تساعدك على الوصول لهدفك</label>
            {goalTasks.map((task, index) => (
              <div className="task-edit-row" key={task.id}>
                <input
                  className="inline-check"
                  type="checkbox"
                  checked={task.done}
                  aria-label={`إنجاز الخطوة ${index + 1}`}
                  onChange={event =>
                    setGoalTasks(current =>
                      current.map(row =>
                        row.id === task.id
                          ? { ...row, done: event.target.checked }
                          : row
                      )
                    )
                  }
                />
                <input
                  type="text"
                  value={task.title}
                  maxLength={100}
                  onChange={event =>
                    setGoalTasks(current =>
                      current.map(row =>
                        row.id === task.id
                          ? { ...row, title: event.target.value }
                          : row
                      )
                    )
                  }
                />
              </div>
            ))}
            {goalTasks.length < 7 && (
              <div className="task-edit-row">
                <input
                  type="text"
                  value={newTask}
                  onChange={event => setNewTask(event.target.value)}
                  maxLength={100}
                  placeholder="أضف خطوة صغيرة"
                  onKeyDown={event => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addGoalTask();
                    }
                  }}
                />
                <button
                  type="button"
                  className="button button-outline button-small"
                  onClick={addGoalTask}
                >
                  إضافة
                </button>
              </div>
            )}
          </div>
          <button
            className="button button-primary"
            onClick={saveGoal}
            disabled={goalMutation.isPending}
          >
            <Target size={17} />
            {goalMutation.isPending ? "جارٍ الحفظ…" : "احفظ هدفي الأسبوعي"}
          </button>
        </div>
        <div className="paper-card card-pad">
          <span className="eyebrow">تذكير لطيف</span>
          <h3 style={{ color: "var(--navy)" }}>اختر هدفًا ممكنًا</h3>
          <p className="muted" style={{ lineHeight: 1.9 }}>
            قسّم هدفك إلى خطوات قصيرة وواضحة. إذا لم تنجح خطوة اليوم، جرّب من
            جديد غدًا؛ المهم أن تواصل المحاولة.
          </p>
          <div className="notice">
            هدفك خاص بك، وليس هناك ترتيب أو مقارنة بين الطلاب.
          </div>
        </div>
      </section>

      <div className="section-heading">
        <h2>أيامي المسجلة</h2>
        <span className="section-count">سجلّك الشخصي فقط</span>
      </div>
      <section className="paper-card card-pad">
        <div className="history-grid">
          {answerCounts.slice(0, 14).map(day => (
            <div className="history-day" key={day.date}>
              <strong>
                {new Intl.DateTimeFormat("ar", {
                  day: "numeric",
                  month: "short",
                }).format(new Date(`${day.date}T12:00:00Z`))}
              </strong>
              <span>
                {day.done}/{day.total}
              </span>
            </div>
          ))}
        </div>
        {answerCounts.length === 0 && (
          <p className="empty-state">
            ستظهر هنا الأيام التي تسجّلها. ابدأ بتسجيل إنجازات اليوم.
          </p>
        )}
      </section>
      <div
        style={{ display: "flex", justifyContent: "center", marginTop: "1rem" }}
      >
        <button
          className="button button-primary"
          onClick={saveAnswers}
          disabled={answersMutation.isPending}
        >
          {answersMutation.isPending ? "جارٍ الحفظ…" : "احفظ إجابات اليوم"}
        </button>
      </div>
      <p className="footer-note">
        برنامج عبادي وتربوي بإشراف جامع السمانة · التزامك رحلة شخصية
      </p>
    </main>
  );
}

function useStudentQuery(enabled = true) {
  return trpc.student.dashboard.useQuery(undefined, { enabled });
}

function StudentInviteManager() {
  const utils = trpc.useUtils();
  const invitesQuery = trpc.admin.invites.useQuery();
  const [form, setForm] = useState<{
    displayName: string;
    stage: ProgramStage;
    grade: ProgramGrade;
  }>({ displayName: "", stage: "primary", grade: "1" });
  const [latestCode, setLatestCode] = useState("");
  const createInvite = trpc.admin.createInvite.useMutation({
    onSuccess: result => {
      setLatestCode(result.code);
      setForm(current => ({ ...current, displayName: "" }));
      toast.success("تم إنشاء رمز الدعوة");
      utils.admin.invites.invalidate();
      utils.admin.roster.invalidate();
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
        التسجيل الذاتي متاح للطلاب. ويمكنك أيضًا إصدار دعوة اختيارية لطالب محدّد؛
        أدخل اسمه ومرحلته وصفّه وشارك الرمز معه، وسيختار اسم المستخدم وكلمة المرور
        بنفسه.
      </p>
      <form
        className="invite-form"
        onSubmit={event => {
          event.preventDefault();
          createInvite.mutate(form);
        }}
      >
        <div className="field">
          <label>اسم الطالب</label>
          <input
            required
            minLength={2}
            value={form.displayName}
            onChange={event =>
              setForm(current => ({
                ...current,
                displayName: event.target.value,
              }))
            }
          />
        </div>
        <div className="field">
          <label>المرحلة</label>
          <select
            value={form.stage}
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
          <label>الصف</label>
          <select
            value={form.grade}
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
            >
              إلغاء
            </button>
          </div>
        ))}
        {!invitesQuery.isLoading && pendingInvites.length === 0 && (
          <p className="muted">لا توجد دعوات معلّقة حاليًا.</p>
        )}
      </div>
    </section>
  );
}

function AdminPage({
  roster,
  programItems,
  programTitle,
  startDate,
  endDate,
  setProgramItems,
  setProgramTitle,
  setStartDate,
  setEndDate,
  userId,
}: {
  roster: RosterRow[];
  programItems: ProgramItem[];
  programTitle: string;
  startDate: string;
  endDate: string;
  setProgramItems: (items: ProgramItem[]) => void;
  setProgramTitle: (value: string) => void;
  setStartDate: (value: string) => void;
  setEndDate: (value: string) => void;
  userId: number;
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
  const reportInput = {
    ...(filters.from ? { from: filters.from } : {}),
    ...(filters.to ? { to: filters.to } : {}),
    ...(filters.stage !== "all"
      ? { stage: filters.stage as ProgramStage }
      : {}),
    ...(filters.grade !== "all" ? { grade: filters.grade } : {}),
    ...(filters.userId !== "all" ? { userId: Number(filters.userId) } : {}),
    ...(filters.activity !== "all" ? { activity: filters.activity } : {}),
    limit: 5000,
  };
  const reportQuery = trpc.admin.report.useQuery(reportInput, {
    enabled: tab === "report",
  });
  const updateStudent = trpc.admin.updateStudent.useMutation({
    onSuccess: () => {
      toast.success("تم حفظ بيانات الطالب");
      utils.admin.roster.invalidate();
      utils.admin.report.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const setRole = trpc.admin.setRole.useMutation({
    onSuccess: () => {
      toast.success("تم تحديث الصلاحية");
      utils.admin.roster.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const resetPassword = trpc.admin.resetStudentPassword.useMutation({
    onSuccess: result => {
      setTemporaryPassword(result.temporaryPassword);
      toast.success("أُنشئت كلمة مرور مؤقتة؛ اعرضها للطالب الآن");
    },
    onError: error => toast.error(error.message),
  });
  const saveProgram = trpc.admin.saveProgram.useMutation({
    onSuccess: () => {
      toast.success("تم تحديث إعدادات البرنامج");
      utils.student.dashboard.invalidate();
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
          value === "1h" ||
          value === "2h" ||
          value === "3h" ||
          value === "3" ||
          value === "30to60"
      ).length,
    0
  );

  const selectStudent = (row: RosterRow) => {
    setSelectedStudent(row);
    setTemporaryPassword("");
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
    });

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
            ["students", "الطلاب"],
            ["settings", "إعدادات البرنامج"],
          ] as Array<[AdminTab, string]>
        ).map(([key, label]) => (
          <button
            key={key}
            className={`tab-button ${tab === key ? "active" : ""}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </nav>
      {tab === "students" && <StudentInviteManager />}

      {tab === "report" && (
        <>
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
                <span className="stat-value">{logsDone}</span>
              </div>
            </div>
            <div className="paper-card card-pad">
              <span className="eyebrow">ملخص آمن</span>
              <h3 style={{ color: "var(--navy)" }}>
                تابع التقدّم، لا المقارنة
              </h3>
              <p className="muted" style={{ lineHeight: 1.8, marginBottom: 0 }}>
                تُستخدم الأرقام لمساندة الطلاب وتحسين البرنامج، لا لنشر ترتيب
                بينهم.
              </p>
            </div>
          </section>
          <section className="paper-card card-pad">
            <p className="muted" style={{ marginTop: 0, fontSize: ".78rem" }}>
              تظهر أحدث ٥٬٠٠٠ إجابة مطابقة للمرشحات.
            </p>
            <div className="filters">
              <div className="field">
                <label>من تاريخ</label>
                <input
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
                <label>إلى تاريخ</label>
                <input
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
                <label>المرحلة</label>
                <select
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
                <label>الصف</label>
                <select
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
                <label>الطالب</label>
                <select
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
              <button
                className="button button-outline"
                onClick={() => exportCsv(filteredLogs)}
              >
                {" "}
                <Download size={16} /> CSV
              </button>
            </div>
            <div
              className="field"
              style={{ maxWidth: 320, marginTop: ".5rem" }}
            >
              <label>تصفية حسب العمل المسجّل</label>
              <select
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
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>التاريخ</th>
                    <th>الطالب</th>
                    <th>المرحلة / الصف</th>
                    <th>الأعمال المسجلة</th>
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
                                {item?.title ?? key}: {answerText(value, item)}
                              </span>
                            );
                          }
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {reportQuery.isLoading && (
                <p className="empty-state">جارٍ تحميل التقرير…</p>
              )}
              {!reportQuery.isLoading && filteredLogs.length === 0 && (
                <p className="empty-state">
                  لا توجد إجابات مطابقة للمرشّحات بعد.
                </p>
              )}
            </div>
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
              <table>
                <thead>
                  <tr>
                    <th>الاسم</th>
                    <th>المرحلة والصف</th>
                    <th>الحالة</th>
                    <th>الصلاحية</th>
                  </tr>
                </thead>
                <tbody>
                  {roster.map(row => (
                    <tr
                      key={row.userId}
                      onClick={() => selectStudent(row)}
                      style={{
                        cursor: "pointer",
                        background:
                          selectedStudent?.userId === row.userId
                            ? "#fff8df"
                            : "",
                      }}
                    >
                      <td>
                        {row.displayName ??
                          row.loginName ??
                          `حساب ${row.userId}`}
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
                  <label>الاسم المعروض</label>
                  <input
                    value={studentForm.displayName}
                    onChange={event =>
                      setStudentForm(current => ({
                        ...current,
                        displayName: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="field">
                  <label>المرحلة</label>
                  <select
                    value={studentForm.stage}
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
                  <label>الصف</label>
                  <select
                    value={studentForm.grade}
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
                  <label>صلاحية الحساب</label>
                  <select
                    value={selectedStudent.role}
                    disabled={selectedStudent.userId === userId}
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
                        resetPassword.mutate({ userId: selectedStudent.userId })
                      }
                      disabled={resetPassword.isPending}
                    >
                      {resetPassword.isPending
                        ? "جارٍ الإنشاء…"
                        : "إصدار كلمة مرور مؤقتة للطالب"}
                    </button>
                    {temporaryPassword && (
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
                          شاركها مع الطالب بأمان. بعد مغادرة هذه الصفحة لن تظهر مجددًا.
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
                <label>اسم البرنامج</label>
                <input
                  value={programTitle}
                  onChange={event => setProgramTitle(event.target.value)}
                />
              </div>
              <div className="field">
                <label>تاريخ البداية</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={event => setStartDate(event.target.value)}
                />
              </div>
              <div className="field">
                <label>تاريخ النهاية</label>
                <input
                  type="date"
                  value={endDate}
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
                عدّل نص السؤال وإرشاده وخيارات الإجابة، أو أخفِ النشاط. اضغط حفظ
                إعدادات البرنامج لتطبيق التغييرات على الجميع. هذه التعديلات
                تغيّر النصوص الظاهرة فقط ولا تعدّل إجابات الطلاب المحفوظة.
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
                      maxLength={100}
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
                    <summary>تعديل نص خيارات الإجابة لهذا السؤال</summary>
                    {item.choices.map((choice, choiceIndex) => (
                      <div className="task-edit-row" key={choice.value}>
                        <span className="pill">{choice.value}</span>
                        <input
                          aria-label={`نص الخيار ${choiceIndex + 1}`}
                          value={choice.label}
                          maxLength={60}
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
                      </div>
                    ))}
                  </details>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}

function answerText(value: string, item?: ProgramItem) {
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
    under30: "أقل من ٣٠ دقيقة",
    "30to60": "٣٠–٦٠ دقيقة",
    over60: "أكثر من ساعة",
  };
  return labels[value] ?? value;
}

function LoginPage() {
  const utils = trpc.useUtils();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const completeLogin = (user: {
    id: number;
    name: string | null;
    role: "user" | "admin";
  }) => {
    utils.auth.me.setData(undefined, user);
    void utils.invalidate();
  };
  const login = trpc.auth.login.useMutation({
    onSuccess: user => {
      completeLogin(user);
      toast.success("تم تسجيل الدخول");
    },
    onError: error => toast.error(error.message),
  });
  const register = trpc.auth.registerStudent.useMutation({
    onSuccess: user => {
      completeLogin(user);
      toast.success("أُنشئ حسابك بنجاح؛ أكمل بيانات ملفك الآن.");
    },
    onError: error => toast.error(error.message),
  });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (mode === "login") {
      login.mutate({ username, password });
      return;
    }
    register.mutate({ username, password });
  };
  const pending = login.isPending || register.isPending;

  return (
    <div className="login-wrap">
      <section className="paper-card login-card">
        <div className="login-emblem">
          <MoonStar size={34} />
        </div>
        <span className="eyebrow">متابعة خاصة لكل طالب</span>
        <h1 className="page-title">خطوة صغيرة اليوم، عادة جميلة غدًا</h1>
        <p className="muted" style={{ lineHeight: 1.9 }}>
          دفتر إلكتروني للعبادة والتعلّم والهدف الأسبوعي بإشراف جامع السمانة.
          بيانات كل طالب خاصة ولا يراها الطلاب الآخرون.
        </p>
        <div className="tabs" role="tablist" aria-label="الحساب">
          <button
            type="button"
            className={`tab-button ${mode === "login" ? "active" : ""}`}
            onClick={() => setMode("login")}
          >
            تسجيل الدخول
          </button>
          <button
            type="button"
            className={`tab-button ${mode === "register" ? "active" : ""}`}
            onClick={() => setMode("register")}
          >
            إنشاء حساب
          </button>
        </div>
        <form onSubmit={submit} className="login-form">
          <div className="field">
            <label htmlFor="account-username">اسم المستخدم</label>
            <input
              id="account-username"
              required
              autoComplete="username"
              dir="ltr"
              value={username}
              onChange={event => setUsername(event.target.value.toLowerCase())}
              minLength={3}
              maxLength={32}
              pattern="[a-z0-9][a-z0-9_-]*"
              placeholder="مثال: ahmad24"
            />
            {mode === "register" && (
              <span className="task-hint">
                حروف إنجليزية صغيرة وأرقام وشرطة سفلية فقط.
              </span>
            )}
          </div>
          <div className="field">
            <label htmlFor="account-password">كلمة المرور</label>
            <input
              id="account-password"
              required
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={event => setPassword(event.target.value)}
              minLength={mode === "register" ? 10 : 1}
              maxLength={128}
            />
            {mode === "register" && (
              <span className="task-hint">
                استخدم ١٠ أحرف أو أكثر واحفظها في مكان آمن.
              </span>
            )}
          </div>
          <button className="button button-primary" type="submit" disabled={pending}>
            {pending
              ? "جارٍ التحقق…"
              : mode === "login"
                ? "دخول آمن"
                : "إنشاء حساب الطالب"}
          </button>
        </form>
        <p className="footer-note">
          للتسجيل أدخل اسم مستخدم وكلمة مرور فقط. بعد ذلك أكمل اسمك والمرحلة والصف.
        </p>
      </section>
    </div>
  );
}

export default function Home() {
  const auth = useAuth();
  const utils = trpc.useUtils();
  const [view, setView] = useState<View>("student");
  const dashboardQuery = useStudentQuery(auth.isAuthenticated);
  const profile = dashboardQuery.data?.profile;
  const isAdmin = auth.user?.role === "admin";
  useEffect(() => {
    if (isAdmin) setView("admin");
  }, [isAdmin]);
  const rosterQuery = trpc.admin.roster.useQuery(undefined, {
    enabled: isAdmin && view === "admin",
  });
  const saveProgramSeed = dashboardQuery.data?.program;
  const [programTitle, setProgramTitle] = useState("برنامج عبادتي");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [programItems, setProgramItems] = useState<ProgramItem[]>(
    DEFAULT_PROGRAM_ITEMS
  );
  useEffect(() => {
    if (!saveProgramSeed) return;
    setProgramTitle(saveProgramSeed.title);
    setStartDate(saveProgramSeed.startDate);
    setEndDate(saveProgramSeed.endDate);
    setProgramItems(
      saveProgramSeed.dailyItems?.length
        ? saveProgramSeed.dailyItems
        : DEFAULT_PROGRAM_ITEMS
    );
  }, [
    saveProgramSeed?.title,
    saveProgramSeed?.startDate,
    saveProgramSeed?.endDate,
    saveProgramSeed?.dailyItems,
  ]);

  if (auth.loading)
    return (
      <div className="app-shell">
        <div className="topbar">
          <div className="topbar-inner">
            <Brand />
          </div>
        </div>
        <div className="loading">جارٍ التحقق من الدخول…</div>
      </div>
    );
  if (!auth.isAuthenticated)
    return (
      <div className="app-shell">
        <div className="topbar">
          <div className="topbar-inner">
            <Brand />
          </div>
        </div>
        <LoginPage />
      </div>
    );

  const userName = profile?.displayName ?? auth.user?.name ?? "أهلًا بك";
  const logout = () =>
    auth
      .logout()
      .then(() => {
        toast.success("تم تسجيل الخروج");
        utils.invalidate();
      })
      .catch((error: unknown) =>
        toast.error(
          error instanceof Error ? error.message : "تعذر تسجيل الخروج"
        )
      );
  return (
    <div className="app-shell">
      <Header
        userName={userName}
        isAdmin={isAdmin}
        view={view}
        setView={setView}
        logout={logout}
      />
      {view === "admin" && isAdmin ? (
        <>
          {rosterQuery.isLoading ? (
            <div className="loading">جارٍ تحميل لوحة المشرف…</div>
          ) : (
            <AdminPage
              roster={(rosterQuery.data ?? []) as RosterRow[]}
              programItems={programItems}
              programTitle={programTitle}
              startDate={startDate}
              endDate={endDate}
              setProgramItems={setProgramItems}
              setProgramTitle={setProgramTitle}
              setStartDate={setStartDate}
              setEndDate={setEndDate}
              userId={auth.user?.id ?? 0}
            />
          )}
        </>
      ) : dashboardQuery.isLoading ? (
        <div className="loading">جارٍ تحميل دفتر المتابعة…</div>
      ) : dashboardQuery.error ? (
        <div className="page-wrap">
          <div className="error-box">
            تعذر تحميل البرنامج. حاول تحديث الصفحة.
          </div>
        </div>
      ) : dashboardQuery.data ? (
        isAdmin && !dashboardQuery.data.profile ? (
          <main className="page-wrap">
            <section className="paper-card card-pad">
              <span className="eyebrow">حساب المشرف</span>
              <h1 className="page-title">لا يوجد ملف طالب لهذا الحساب</h1>
              <p className="muted">
                حساب المشرف منفصل عن ملفات الطلاب. استخدم لوحة المشرف لإدارة
                البرنامج والطلاب.
              </p>
              <button
                className="button button-primary"
                onClick={() => setView("admin")}
              >
                العودة إلى لوحة المشرف
              </button>
            </section>
          </main>
        ) : (
          <StudentPage
            dashboard={dashboardQuery.data}
            userName={auth.user?.name ?? ""}
          />
        )
      ) : null}
    </div>
  );
}
