import {
  FOCUS_ACTIVITY_KEYS,
  PHONE_ANSWER_VALUES,
  YES_NO_ANSWER_VALUES,
} from "./program";

export type FocusActivityRecord = {
  answers?: Record<string, string> | null;
};

export type FocusActivityStatistics = {
  recordCount: number;
  parents: {
    done: number;
    missed: number;
    unrecognized: number;
    missing: number;
    answered: number;
    completionPercent: number | null;
  };
  phone: {
    under30: number;
    withinTarget: number;
    over60: number;
    unrecognized: number;
    missing: number;
    answered: number;
    targetPercent: number | null;
  };
};

function percentageOf(value: number, total: number): number | null {
  return total > 0 ? Math.round((value / total) * 100) : null;
}

export function summarizeFocusActivities(
  records: readonly FocusActivityRecord[]
): FocusActivityStatistics {
  const result: FocusActivityStatistics = {
    recordCount: records.length,
    parents: {
      done: 0,
      missed: 0,
      unrecognized: 0,
      missing: 0,
      answered: 0,
      completionPercent: null,
    },
    phone: {
      under30: 0,
      withinTarget: 0,
      over60: 0,
      unrecognized: 0,
      missing: 0,
      answered: 0,
      targetPercent: null,
    },
  };

  for (const record of records) {
    const parentsAnswer = record.answers?.[FOCUS_ACTIVITY_KEYS.parents];
    if (parentsAnswer === YES_NO_ANSWER_VALUES.done) result.parents.done += 1;
    else if (parentsAnswer === YES_NO_ANSWER_VALUES.missed)
      result.parents.missed += 1;
    else if (parentsAnswer === undefined) result.parents.missing += 1;
    else result.parents.unrecognized += 1;

    const phoneAnswer = record.answers?.[FOCUS_ACTIVITY_KEYS.phone];
    if (phoneAnswer === PHONE_ANSWER_VALUES.under30) result.phone.under30 += 1;
    else if (phoneAnswer === PHONE_ANSWER_VALUES.withinTarget)
      result.phone.withinTarget += 1;
    else if (phoneAnswer === PHONE_ANSWER_VALUES.over60)
      result.phone.over60 += 1;
    else if (phoneAnswer === undefined) result.phone.missing += 1;
    else result.phone.unrecognized += 1;
  }

  result.parents.answered = result.parents.done + result.parents.missed;
  result.parents.completionPercent = percentageOf(
    result.parents.done,
    result.parents.answered
  );
  result.phone.answered =
    result.phone.under30 + result.phone.withinTarget + result.phone.over60;
  result.phone.targetPercent = percentageOf(
    result.phone.withinTarget,
    result.phone.answered
  );

  return result;
}
