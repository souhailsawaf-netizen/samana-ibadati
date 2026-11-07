import { ShieldCheck, Target } from "lucide-react";
import type { FocusActivityStatistics as FocusActivityStatisticsData } from "../../../shared/focus-statistics";

const arabicNumberFormatter = new Intl.NumberFormat("ar");

function formatCount(value: number): string {
  return arabicNumberFormatter.format(value);
}

function FocusStatisticsBar({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const percentage = total > 0 ? Math.round((value / total) * 100) : null;
  const percentageLabel =
    percentage === null ? "—" : `${formatCount(percentage)}٪`;

  return (
    <div className="focus-stat-row">
      <div className="focus-stat-row-title">
        <span>{label}</span>
        <strong>
          {formatCount(value)} · {percentageLabel}
        </strong>
      </div>
      <div
        className="focus-stat-track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percentage ?? 0}
        aria-valuetext={
          percentage === null ? "لا توجد إجابات" : percentageLabel
        }
      >
        <span
          aria-hidden="true"
          style={{ width: `${percentage ?? 0}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export function FocusActivityStatistics({
  statistics,
}: {
  statistics: FocusActivityStatisticsData;
}) {
  const parentAnswers = statistics.parents.answered;
  const phoneAnswers = statistics.phone.answered;

  return (
    <section
      className="focus-stat-content"
      aria-labelledby="focus-statistics-title"
    >
      <div className="section-heading" style={{ marginTop: 0 }}>
        <div>
          <span className="eyebrow">قراءة إجمالية بلا ترتيب للطلاب</span>
          <h2 id="focus-statistics-title">بر الوالدين ووقت الجوال</h2>
        </div>
        <span className="pill">
          {formatCount(statistics.recordCount)} سجلًا
        </span>
      </div>
      {statistics.recordCount === 0 && (
        <p className="notice" style={{ marginBottom: "1rem" }}>
          لا توجد سجلات مطابقة لهذه المرشحات حتى الآن.
        </p>
      )}
      <div className="focus-stat-grid">
        <article className="focus-stat-card">
          <div className="focus-stat-heading">
            <span className="focus-stat-icon">
              <ShieldCheck size={20} aria-hidden="true" />
            </span>
            <div>
              <span className="eyebrow">بر الوالدين</span>
              <h3>نسبة الإنجاز من الإجابات المعروفة</h3>
            </div>
          </div>
          <div className="focus-stat-highlight">
            <strong>
              {statistics.parents.completionPercent === null
                ? "—"
                : `${formatCount(statistics.parents.completionPercent)}٪`}
            </strong>
            <span>
              أجاب «أنجزت» من {formatCount(parentAnswers)} إجابة معروفة
            </span>
          </div>
          <FocusStatisticsBar
            label="أنجزت بر الوالدين"
            value={statistics.parents.done}
            total={parentAnswers}
            color="var(--status-green)"
          />
          <FocusStatisticsBar
            label="لم أنجز"
            value={statistics.parents.missed}
            total={parentAnswers}
            color="var(--status-red)"
          />
          <p className="focus-stat-note">
            غير مسجّل: {formatCount(statistics.parents.missing)} · قيمة غير
            معروفة: {formatCount(statistics.parents.unrecognized)}
          </p>
        </article>

        <article className="focus-stat-card">
          <div className="focus-stat-heading">
            <span className="focus-stat-icon">
              <Target size={20} aria-hidden="true" />
            </span>
            <div>
              <span className="eyebrow">وقت اللعب على الجوال</span>
              <h3>التوزيع اليومي للمدة المسجلة</h3>
            </div>
          </div>
          <div className="focus-stat-highlight">
            <strong>
              {statistics.phone.targetPercent === null
                ? "—"
                : `${formatCount(statistics.phone.targetPercent)}٪`}
            </strong>
            <span>
              ضمن الهدف ٣٠–٦٠ دقيقة من {formatCount(phoneAnswers)} إجابة معروفة
            </span>
          </div>
          <FocusStatisticsBar
            label="أقل من ٣٠ دقيقة"
            value={statistics.phone.under30}
            total={phoneAnswers}
            color="var(--status-yellow)"
          />
          <FocusStatisticsBar
            label="٣٠–٦٠ دقيقة"
            value={statistics.phone.withinTarget}
            total={phoneAnswers}
            color="var(--status-green)"
          />
          <FocusStatisticsBar
            label="أكثر من ساعة"
            value={statistics.phone.over60}
            total={phoneAnswers}
            color="var(--status-red)"
          />
          <p className="focus-stat-note">
            غير مسجّل: {formatCount(statistics.phone.missing)} · قيمة غير
            معروفة: {formatCount(statistics.phone.unrecognized)}
          </p>
        </article>
      </div>
      <p className="muted focus-stat-footnote">
        النسب محسوبة من الإجابات المعروفة فقط؛ السجل الذي لا يحتوي إجابة لا
        يُحسب على أنه «لم أنجز». تعرض الصفحة أحدث ٥٬٠٠٠ سجل مطابق للمرشحات.
      </p>
    </section>
  );
}
