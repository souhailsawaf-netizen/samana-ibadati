import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import {
  CATEGORY_LABELS,
  DEFAULT_PROGRAM_ITEMS,
  FOCUS_ACTIVITY_KEYS,
  GRADES_BY_STAGE,
  getAnswerIndicator,
  getProgramDoneCount,
  isProgramItemComplete,
  type ProgramGrade,
  type ProgramItem,
  type ProgramStage,
} from "../../../shared/program";
import { DAILY_STORIES } from "../../../shared/stories.data";
import type { DailyStory } from "../../../shared/stories";
import {
  hasExactStudentRegistrationPasswordLength,
  isValidUsername,
  normalizeUsername,
  STUDENT_REGISTRATION_PASSWORD_LENGTH,
} from "../../../shared/auth";
import {
  BookOpen,
  Check,
  KeyRound,
  LogOut,
  MoonStar,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import { toast } from "sonner";
import type { RosterRow } from "./AdminPage";

type View = "student" | "admin";
const AdminPage = lazy(() => import("./AdminPage"));
type Answers = Record<string, string>;

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
function percent(part: number, total: number) {
  return total ? Math.round((part / total) * 100) : 0;
}
function getDailyProgressMessage(completedCount: number, totalCount: number) {
  if (totalCount === 0) return "لا توجد أعمال مفعّلة اليوم.";
  if (completedCount === 0) return "ابدأ بخطوة تناسبك، وكل يوم بداية جديدة.";
  if (completedCount === totalCount) return "ما شاء الله، أتممت خطوات اليوم!";
  return `أحسنت، أتممت ${completedCount} من ${totalCount}. أكمل على راحتك.`;
}
function getStudentSaveStatusMessage(state: {
  isPending: boolean;
  hasError: boolean;
  hasUnsavedAnswers: boolean;
  isSuccess: boolean;
  hasSavedLog: boolean;
}) {
  if (state.isPending) return "جارٍ حفظ يومك…";
  if (state.hasError) return "تعذّر الحفظ. جرّب مرة أخرى.";
  if (state.hasUnsavedAnswers) return "لديك تغييرات لم تُحفظ بعد.";
  if (state.isSuccess || state.hasSavedLog) return "تقدّمك محفوظ.";
  return "اختر إجاباتك، ثم احفظ يومك.";
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
              <label htmlFor="confirm-password">
                تأكيد كلمة المرور الجديدة
              </label>
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
            <label htmlFor="student-display-name">
              الاسم الذي سيظهر في البرنامج
            </label>
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
                <option key={value} value={value}>
                  الصف {value}
                </option>
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
  const [hasUnsavedAnswers, setHasUnsavedAnswers] = useState(false);
  const hasUnsavedAnswersRef = useRef(false);
  const activeAnswersDateRef = useRef(dashboard.today);
  const profileMutation = trpc.student.createProfile.useMutation({
    onSuccess: () => {
      toast.success("اكتمل ملفك، أهلًا بك في البرنامج!");
      utils.student.dashboard.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const answersMutation = trpc.student.saveAnswers.useMutation({
    onSuccess: () => {
      hasUnsavedAnswersRef.current = false;
      setHasUnsavedAnswers(false);
      toast.success("تم حفظ يومك، أحسنت!");
      utils.student.dashboard.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const goalMutation = trpc.student.saveGoal.useMutation({
    onSuccess: async () => {
      toast.success("حُفظ هدفك الأسبوعي");
      await utils.student.dashboard.invalidate();
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
  const completedCount = getProgramDoneCount(items, answers);
  const completionPercent = percent(completedCount, enabledItems.length);
  const progressMessage = getDailyProgressMessage(
    completedCount,
    enabledItems.length
  );
  const saveStatusMessage = getStudentSaveStatusMessage({
    isPending: answersMutation.isPending,
    hasError: answersMutation.isError,
    hasUnsavedAnswers,
    isSuccess: answersMutation.isSuccess,
    hasSavedLog: Boolean(dashboard.todayLog),
  });
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
  const stories = dashboard.program.dailyStories?.length
    ? dashboard.program.dailyStories
    : DAILY_STORIES;
  const story = stories[storyOffset % stories.length];

  useEffect(() => {
    const dateChanged = activeAnswersDateRef.current !== dashboard.today;
    activeAnswersDateRef.current = dashboard.today;
    if (hasUnsavedAnswersRef.current && !dateChanged) return;
    if (hasUnsavedAnswersRef.current && dateChanged) {
      hasUnsavedAnswersRef.current = false;
      setHasUnsavedAnswers(false);
      toast.error(
        "لم تُحفظ إجابات اليوم السابق؛ ابدأ تسجيل يومك الجديد من البداية."
      );
    }
    setAnswers(dashboard.todayLog?.answers ?? {});
  }, [dashboard.today, dashboard.todayLog?.id, dashboard.todayLog?.updatedAt]);
  useEffect(() => {
    setGoalTitle(dashboard.goal?.title ?? "");
    setGoalTasks(dashboard.goal?.tasks ?? []);
  }, [dashboard.goal?.id, dashboard.goal?.updatedAt]);

  const answerCounts = useMemo(
    () =>
      dashboard.recentLogs.map(log => ({
        date: log.logDate,
        done: getProgramDoneCount(items, log.answers ?? {}, {
          preserveLegacyPhoneAnswers: true,
        }),
        total: items.filter(item => item.enabled).length,
      })),
    [dashboard.recentLogs, items]
  );
  const totalAnswered = dashboard.recentLogs.reduce(
    (sum, row) => sum + Object.keys(row.answers ?? {}).length,
    0
  );
  const totalDone = dashboard.recentLogs.reduce(
    (sum, row) =>
      sum +
      getProgramDoneCount(items, row.answers ?? {}, {
        preserveLegacyPhoneAnswers: true,
      }),
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
  const changeAnswer = (key: string, value: string) => {
    if (answers[key] === value) return;
    hasUnsavedAnswersRef.current = true;
    setAnswers(current => ({ ...current, [key]: value }));
    setHasUnsavedAnswers(true);
  };
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
    <main className="page-wrap student-page">
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
            <p className="student-progress-message" aria-live="polite">
              {progressMessage}
            </p>
          </div>
          <div
            className="progress-ring"
            role="progressbar"
            aria-label="إنجازات اليوم"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={completionPercent}
            aria-valuetext={`${completedCount} من ${enabledItems.length} أعمال مكتملة`}
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
            <span className="stat-value" aria-live="polite">
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

      <div
        className="student-save-bar"
        role="region"
        aria-label="حفظ التقدم اليومي"
      >
        <p className="student-save-status" role="status" aria-live="polite">
          {saveStatusMessage}
        </p>
        <button
          className="button button-primary student-save-button"
          type="button"
          onClick={saveAnswers}
          disabled={answersMutation.isPending}
        >
          {answersMutation.isPending ? "جارٍ الحفظ…" : "احفظ إجابات اليوم"}
        </button>
      </div>

      {enabledItems.some(item => item.key === "story") && (
        <section className="paper-card story-card">
          <div className="story-label">
            <BookOpen size={17} aria-hidden="true" /> قصة اليوم{" "}
            <span>الحكاية {storyNumber}</span>
          </div>
          <h2>{story.title}</h2>
          <p>{story.body}</p>
          <div className="story-takeaway">
            <Sparkles size={16} aria-hidden="true" /> {story.takeaway}
          </div>
          <p className="story-note">حكاية تربوية قصيرة من نسج الخيال.</p>
          <button
            type="button"
            aria-pressed={answers.story === "done"}
            disabled={answersMutation.isPending}
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
                <MoonStar size={18} aria-hidden="true" />
              ) : category === "learning" ? (
                <BookOpen size={18} aria-hidden="true" />
              ) : (
                <Users size={18} aria-hidden="true" />
              )}
              {CATEGORY_LABELS[category]}
            </h3>
            <div className="task-list">
              {sectionItems.map(item => {
                const indicator = getAnswerIndicator(
                  item.key,
                  answers[item.key],
                  item.choices
                );
                const hasIndicator =
                  item.key === FOCUS_ACTIVITY_KEYS.parents ||
                  item.key === FOCUS_ACTIVITY_KEYS.phone;
                return (
                  <article
                    key={item.key}
                    className={`task-row ${isProgramItemComplete(item, answers[item.key]) ? "done" : ""}`}
                  >
                    <div className="task-copy">
                      <div className="task-title-row">
                        <p className="task-name">{item.title}</p>
                        {hasIndicator && (
                          <span
                            className={`answer-indicator ${indicator?.tone ?? "unanswered"}`}
                            role="img"
                            aria-label={
                              indicator?.label ?? "لم يتم اختيار إجابة"
                            }
                            title={indicator?.label ?? "لم يتم اختيار إجابة"}
                          />
                        )}
                      </div>
                      <span className="task-hint">{item.hint}</span>
                    </div>
                    <div className="task-controls">
                      {item.response === "yesno" ? (
                        item.choices.map(choice => {
                          const selected = answers[item.key] === choice.value;
                          const activeClass = choice.tone
                            ? `active-${choice.tone}`
                            : choice.value === "done"
                              ? "active-yes"
                              : "active-no";
                          return (
                            <button
                              type="button"
                              key={choice.value}
                              aria-pressed={selected}
                              disabled={answersMutation.isPending}
                              className={`choice-btn ${selected ? activeClass : ""}`}
                              onClick={() =>
                                changeAnswer(item.key, choice.value)
                              }
                            >
                              {choice.value === "done" && (
                                <Check size={15} aria-hidden="true" />
                              )}{" "}
                              {choice.label}
                            </button>
                          );
                        })
                      ) : (
                        <select
                          aria-label={`الإجابة عن ${item.title}`}
                          className="choice-select"
                          value={answers[item.key] ?? ""}
                          disabled={answersMutation.isPending}
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
              disabled={goalMutation.isPending}
              onChange={event => setGoalTitle(event.target.value)}
              maxLength={180}
              placeholder="مثال: أقرأ كل يوم قبل النوم"
            />
          </div>
          <div
            className="field"
            role="group"
            aria-labelledby="weekly-goal-steps-label"
          >
            <label id="weekly-goal-steps-label">
              خطوات صغيرة تساعدك على الوصول لهدفك
            </label>
            {goalTasks.map((task, index) => (
              <div className="task-edit-row" key={task.id}>
                <input
                  className="inline-check"
                  type="checkbox"
                  checked={task.done}
                  aria-label={`إنجاز الخطوة ${index + 1}`}
                  disabled={goalMutation.isPending}
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
                  aria-label={`عنوان الخطوة ${index + 1}`}
                  disabled={goalMutation.isPending}
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
                  aria-label="عنوان خطوة جديدة"
                  disabled={goalMutation.isPending}
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
                  disabled={goalMutation.isPending}
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
            <Target size={17} aria-hidden="true" />
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
      <p className="footer-note">
        برنامج عبادي وتربوي بإشراف جامع السمانة · التزامك رحلة شخصية
      </p>
    </main>
  );
}

function useStudentQuery(enabled = true) {
  return trpc.student.dashboard.useQuery(undefined, { enabled });
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
    if (!isValidUsername(username)) {
      toast.error(
        "اسم المستخدم يجب أن يكون من ٣ إلى ٣٢ حرفًا عربيًا أو إنجليزيًا أو رقمًا."
      );
      return;
    }
    if (mode === "login") {
      login.mutate({ username, password });
      return;
    }
    if (!hasExactStudentRegistrationPasswordLength(password)) {
      toast.error("كلمة المرور يجب أن تتكون من ٦ أحرف بالضبط.");
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
              dir="auto"
              value={username}
              onChange={event => setUsername(event.target.value)}
              minLength={3}
              maxLength={128}
              placeholder="مثال: أحمد24 أو ahmad24"
            />
            {mode === "register" && (
              <span className="task-hint">
                من ٣ إلى ٣٢ حرفًا؛ ابدأ بحرف أو رقم، واستخدم العربية أو
                الإنجليزية و _ أو - عند الحاجة.
              </span>
            )}
          </div>
          <div className="field">
            <label htmlFor="account-password">كلمة المرور</label>
            <input
              id="account-password"
              required
              type="password"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              value={password}
              onChange={event => setPassword(event.target.value)}
              minLength={1}
              maxLength={
                mode === "register"
                  ? STUDENT_REGISTRATION_PASSWORD_LENGTH * 2
                  : 128
              }
            />
            {mode === "register" && (
              <span className="task-hint">
                استخدم ٦ أحرف بالضبط؛ يمكنك استخدام الحروف أو الأرقام أو الرموز.
              </span>
            )}
          </div>
          <button
            className="button button-primary"
            type="submit"
            disabled={pending}
          >
            {pending
              ? "جارٍ التحقق…"
              : mode === "login"
                ? "دخول آمن"
                : "إنشاء حساب الطالب"}
          </button>
        </form>
        <p className="footer-note">
          للتسجيل أدخل اسم مستخدم وكلمة مرور فقط. بعد ذلك أكمل اسمك والمرحلة
          والصف.
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
  const programQuery = trpc.program.current.useQuery(undefined, {
    enabled: auth.isAuthenticated,
    refetchInterval: auth.user?.role === "user" ? 15_000 : false,
    refetchOnWindowFocus: true,
  });
  const profile = dashboardQuery.data?.profile;
  const currentProgram = programQuery.data ?? dashboardQuery.data?.program;
  const isAdmin = auth.user?.role === "admin";
  useEffect(() => {
    if (isAdmin) setView("admin");
  }, [isAdmin]);
  const rosterQuery = trpc.admin.roster.useQuery(undefined, {
    enabled: isAdmin && view === "admin",
  });
  const saveProgramSeed = currentProgram;
  const [programTitle, setProgramTitle] = useState("برنامج عبادتي");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [programItems, setProgramItems] = useState<ProgramItem[]>(
    DEFAULT_PROGRAM_ITEMS
  );
  const [programStories, setProgramStories] =
    useState<DailyStory[]>(DAILY_STORIES);
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
    setProgramStories(
      saveProgramSeed.dailyStories?.length
        ? saveProgramSeed.dailyStories
        : DAILY_STORIES
    );
  }, [
    saveProgramSeed?.title,
    saveProgramSeed?.startDate,
    saveProgramSeed?.endDate,
    saveProgramSeed?.dailyItems,
    saveProgramSeed?.dailyStories,
  ]);

  const studentDashboard = dashboardQuery.data
    ? {
        ...dashboardQuery.data,
        program: currentProgram ?? dashboardQuery.data.program,
      }
    : undefined;

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
        <Suspense
          fallback={
            <div className="loading" role="status" aria-live="polite">
              جارٍ تحميل لوحة المشرف…
            </div>
          }
        >
          {rosterQuery.isLoading ? (
            <div className="loading" role="status" aria-live="polite">
              جارٍ تحميل لوحة المشرف…
            </div>
          ) : rosterQuery.error ? (
            <div className="page-wrap">
              <div className="query-error">
                <p className="error-box" role="alert">
                  تعذّر تحميل قائمة الطلاب. حاول مجددًا.
                </p>
                <button
                  type="button"
                  className="button button-outline button-small"
                  onClick={() => void rosterQuery.refetch()}
                  disabled={rosterQuery.isFetching}
                >
                  {rosterQuery.isFetching
                    ? "جارٍ إعادة المحاولة…"
                    : "إعادة المحاولة"}
                </button>
              </div>
            </div>
          ) : (
            <AdminPage
              roster={(rosterQuery.data ?? []) as RosterRow[]}
              programItems={programItems}
              programStories={programStories}
              programTitle={programTitle}
              startDate={startDate}
              endDate={endDate}
              setProgramItems={setProgramItems}
              setProgramStories={setProgramStories}
              setProgramTitle={setProgramTitle}
              setStartDate={setStartDate}
              setEndDate={setEndDate}
              userId={auth.user?.id ?? 0}
              stageNames={stageNames}
            />
          )}
        </Suspense>
      ) : dashboardQuery.isLoading ? (
        <div className="loading">جارٍ تحميل دفتر المتابعة…</div>
      ) : dashboardQuery.error ? (
        <div className="page-wrap">
          <div className="query-error">
            <p className="error-box" role="alert">
              تعذّر تحميل البرنامج. حاول مجددًا.
            </p>
            <button
              type="button"
              className="button button-outline button-small"
              onClick={() => void dashboardQuery.refetch()}
              disabled={dashboardQuery.isFetching}
            >
              {dashboardQuery.isFetching
                ? "جارٍ إعادة المحاولة…"
                : "إعادة المحاولة"}
            </button>
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
            dashboard={studentDashboard ?? dashboardQuery.data}
            userName={auth.user?.name ?? ""}
          />
        )
      ) : null}
    </div>
  );
}
