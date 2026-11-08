import {
  DEFAULT_PROGRAM_ITEMS,
  FOCUS_ACTIVITY_KEYS,
  PHONE_ANSWER_VALUES,
  PARENTS_ANSWER_VALUES,
  getAnswerIndicator,
  getLegacyAnswerLabel,
  type AnswerTone,
  type ProgramChoice,
  type ProgramItem,
} from "./program";

export type FocusActivityRecord = {
  answers?: Record<string, string> | null;
};

export type FocusActivityCategoryStatistic = {
  value: string;
  label: string;
  tone: AnswerTone;
  count: number;
};

export type FocusActivityLegacyStatistic = {
  value: string;
  label: string;
  count: number;
};

type ActivityDistribution = {
  categories: FocusActivityCategoryStatistic[];
  legacy: FocusActivityLegacyStatistic[];
  unrecognized: number;
  missing: number;
  answered: number;
};

export type FocusActivityStatistics = {
  recordCount: number;
  parents: ActivityDistribution & { completionPercent: number | null };
  phone: ActivityDistribution & { targetPercent: number | null };
};

const PHONE_LEGACY_VALUES = [
  PHONE_ANSWER_VALUES.legacy30to60,
  PHONE_ANSWER_VALUES.legacyOver60,
] as const;

function percentageOf(value: number, total: number): number | null {
  return total > 0 ? Math.round((value / total) * 100) : null;
}

function findItem(items: readonly ProgramItem[], key: string) {
  return items.find(item => item.key === key);
}

function createCategories(
  itemKey: string,
  choices: readonly ProgramChoice[]
): FocusActivityCategoryStatistic[] {
  return choices.map(choice => ({
    value: choice.value,
    label: choice.label,
    tone:
      choice.tone ??
      getAnswerIndicator(itemKey, choice.value, choices)?.tone as AnswerTone ??
      "green",
    count: 0,
  }));
}

function createLegacyCategories(
  values: readonly string[]
): FocusActivityLegacyStatistic[] {
  return values.flatMap(value => {
    const label = getLegacyAnswerLabel(FOCUS_ACTIVITY_KEYS.phone, value);
    return label ? [{ value, label, count: 0 }] : [];
  });
}

function countForValue(
  categories: readonly FocusActivityCategoryStatistic[],
  value: string
): number {
  return categories.find(category => category.value === value)?.count ?? 0;
}

export function summarizeFocusActivities(
  records: readonly FocusActivityRecord[],
  programItems: readonly ProgramItem[] = DEFAULT_PROGRAM_ITEMS
): FocusActivityStatistics {
  const parentsItem = findItem(programItems, FOCUS_ACTIVITY_KEYS.parents);
  const phoneItem = findItem(programItems, FOCUS_ACTIVITY_KEYS.phone);
  const parentsCategories = createCategories(
    FOCUS_ACTIVITY_KEYS.parents,
    parentsItem?.choices ?? []
  );
  const phoneCategories = createCategories(
    FOCUS_ACTIVITY_KEYS.phone,
    phoneItem?.choices ?? []
  );
  const phoneLegacy = createLegacyCategories(PHONE_LEGACY_VALUES);
  const parentsByValue = new Map(
    parentsCategories.map(category => [category.value, category])
  );
  const phoneByValue = new Map(
    phoneCategories.map(category => [category.value, category])
  );
  const phoneLegacyByValue = new Map(
    phoneLegacy.map(category => [category.value, category])
  );
  let parentsMissing = 0;
  let parentsUnrecognized = 0;
  let phoneMissing = 0;
  let phoneUnrecognized = 0;

  for (const record of records) {
    const parentsAnswer = record.answers?.[FOCUS_ACTIVITY_KEYS.parents];
    if (parentsAnswer === undefined) parentsMissing += 1;
    else {
      const category = parentsByValue.get(parentsAnswer);
      if (category) category.count += 1;
      else parentsUnrecognized += 1;
    }

    const phoneAnswer = record.answers?.[FOCUS_ACTIVITY_KEYS.phone];
    if (phoneAnswer === undefined) phoneMissing += 1;
    else {
      const category = phoneByValue.get(phoneAnswer);
      if (category) category.count += 1;
      else {
        const legacy = phoneLegacyByValue.get(phoneAnswer);
        if (legacy) legacy.count += 1;
        else phoneUnrecognized += 1;
      }
    }
  }

  const parentsAnswered = parentsCategories.reduce(
    (total, category) => total + category.count,
    0
  );
  const phoneAnswered = phoneCategories.reduce(
    (total, category) => total + category.count,
    0
  );
  const dutifulCount = countForValue(
    parentsCategories,
    PARENTS_ANSWER_VALUES.dutiful
  );
  const withinLimitCount =
    countForValue(phoneCategories, PHONE_ANSWER_VALUES.under30) +
    countForValue(phoneCategories, PHONE_ANSWER_VALUES.within90);

  return {
    recordCount: records.length,
    parents: {
      categories: parentsCategories,
      legacy: [],
      unrecognized: parentsUnrecognized,
      missing: parentsMissing,
      answered: parentsAnswered,
      completionPercent: percentageOf(dutifulCount, parentsAnswered),
    },
    phone: {
      categories: phoneCategories,
      legacy: phoneLegacy,
      unrecognized: phoneUnrecognized,
      missing: phoneMissing,
      answered: phoneAnswered,
      targetPercent: percentageOf(withinLimitCount, phoneAnswered),
    },
  };
}
