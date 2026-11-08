export type ProgramStage = "primary" | "middle";
export const PROGRAM_GRADES = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
] as const;
export type ProgramGrade = (typeof PROGRAM_GRADES)[number];

export const GRADES_BY_STAGE: Record<ProgramStage, readonly ProgramGrade[]> = {
  primary: ["1", "2", "3", "4", "5", "6"],
  middle: ["7", "8", "9"],
};

export function isGradeForStage(stage: ProgramStage, grade: string): boolean {
  return GRADES_BY_STAGE[stage].some(validGrade => validGrade === grade);
}

export type AnswerValue = string;
export type AnswerTone = "green" | "yellow" | "red";
export type AnswerIndicatorTone = AnswerTone | "neutral";

export const FOCUS_ACTIVITY_KEYS = {
  parents: "parents",
  phone: "phone",
} as const;

export const YES_NO_ANSWER_VALUES = {
  done: "done",
  missed: "missed",
} as const;

export const PARENTS_ANSWER_VALUES = {
  dutiful: YES_NO_ANSWER_VALUES.done,
  satisfactory: "satisfactory",
  partial: YES_NO_ANSWER_VALUES.missed,
} as const;

export const PHONE_ANSWER_VALUES = {
  under30: "under30",
  within90: "31to90",
  over90: "over90",
  legacy30to60: "30to60",
  legacyOver60: "over60",
} as const;

export type ProgramChoice = {
  value: string;
  label: string;
  tone?: AnswerTone;
};

export type ProgramItem = {
  key: string;
  title: string;
  category: "worship" | "learning" | "home";
  hint: string;
  response: "yesno" | "study" | "words" | "phone";
  choices: ProgramChoice[];
  enabled: boolean;
};

export function hasSameChoiceValues(
  actual: readonly ProgramChoice[],
  expected: readonly ProgramChoice[]
): boolean {
  if (actual.length !== expected.length) return false;
  const values = new Set(actual.map(choice => choice.value));
  return (
    values.size === actual.length &&
    expected.every(choice => values.has(choice.value))
  );
}

export function isProgramItemComplete(
  item: ProgramItem,
  value: string | undefined,
  options: { preserveLegacyPhoneAnswers?: boolean } = {}
): boolean {
  if (item.key === FOCUS_ACTIVITY_KEYS.parents)
    return (
      value === PARENTS_ANSWER_VALUES.dutiful ||
      value === PARENTS_ANSWER_VALUES.satisfactory
    );
  if (item.key === FOCUS_ACTIVITY_KEYS.phone)
    return (
      value === PHONE_ANSWER_VALUES.under30 ||
      value === PHONE_ANSWER_VALUES.within90 ||
      (options.preserveLegacyPhoneAnswers === true &&
        value === PHONE_ANSWER_VALUES.legacy30to60)
    );
  if (item.response === "yesno") return value === YES_NO_ANSWER_VALUES.done;
  if (item.response === "study")
    return ["1h", "2h", "3h"].includes(value ?? "");
  if (item.response === "words") return value === "3";
  return false;
}

export function getProgramDoneCount(
  items: readonly ProgramItem[],
  answers: Readonly<Record<string, string>>,
  options: { preserveLegacyPhoneAnswers?: boolean } = {}
): number {
  return items.filter(
    item =>
      item.enabled &&
      isProgramItemComplete(item, answers[item.key], options)
  ).length;
}

export type AnswerIndicator = {
  tone: AnswerIndicatorTone;
  label: string;
};

const PARENTS_DEFAULT_CHOICES: ProgramChoice[] = [
  {
    value: PARENTS_ANSWER_VALUES.dutiful,
    label: "بار",
    tone: "green",
  },
  {
    value: PARENTS_ANSWER_VALUES.satisfactory,
    label: "مرضي جيد",
    tone: "yellow",
  },
  {
    value: PARENTS_ANSWER_VALUES.partial,
    label: "مرضي قليلا",
    tone: "red",
  },
];

const PHONE_DEFAULT_CHOICES: ProgramChoice[] = [
  {
    value: PHONE_ANSWER_VALUES.under30,
    label: "٣٠ دقيقة وأقل",
    tone: "green",
  },
  {
    value: PHONE_ANSWER_VALUES.within90,
    label: "٣١–٩٠ دقيقة",
    tone: "yellow",
  },
  {
    value: PHONE_ANSWER_VALUES.over90,
    label: "أكثر من ٩٠ دقيقة",
    tone: "red",
  },
];

function focusDefaultChoices(itemKey: string): ProgramChoice[] {
  if (itemKey === FOCUS_ACTIVITY_KEYS.parents) return PARENTS_DEFAULT_CHOICES;
  if (itemKey === FOCUS_ACTIVITY_KEYS.phone) return PHONE_DEFAULT_CHOICES;
  return [];
}

export function getLegacyAnswerLabel(
  itemKey: string,
  value: string
): string | null {
  if (itemKey !== FOCUS_ACTIVITY_KEYS.phone) return null;
  if (value === PHONE_ANSWER_VALUES.legacy30to60)
    return "٣٠–٦٠ دقيقة (تصنيف سابق)";
  if (value === PHONE_ANSWER_VALUES.legacyOver60)
    return "أكثر من ساعة (تصنيف سابق)";
  return null;
}

export function getAnswerIndicator(
  itemKey: string,
  value?: string,
  choices?: readonly ProgramChoice[]
): AnswerIndicator | null {
  if (!value) return null;
  if (
    itemKey !== FOCUS_ACTIVITY_KEYS.parents &&
    itemKey !== FOCUS_ACTIVITY_KEYS.phone
  )
    return null;

  const configuredChoice = choices?.find(choice => choice.value === value);
  const defaultChoice = focusDefaultChoices(itemKey).find(
    choice => choice.value === value
  );
  const tone = configuredChoice?.tone ?? defaultChoice?.tone;
  if (configuredChoice && tone)
    return { tone, label: configuredChoice.label };
  if (defaultChoice?.tone)
    return { tone: defaultChoice.tone, label: defaultChoice.label };

  const legacyLabel = getLegacyAnswerLabel(itemKey, value);
  return legacyLabel ? { tone: "neutral", label: legacyLabel } : null;
}

export type GoalTask = { id: string; title: string; done: boolean };

const yesNo = (): ProgramChoice[] => [
  { value: YES_NO_ANSWER_VALUES.done, label: "أنجزت" },
  { value: YES_NO_ANSWER_VALUES.missed, label: "لم أنجز" },
];
const study = (): ProgramChoice[] => [
  { value: "less1", label: "أقل من ساعة" },
  { value: "1h", label: "ساعة" },
  { value: "2h", label: "ساعتان" },
  { value: "3h", label: "٣ ساعات فأكثر" },
];
const words = (): ProgramChoice[] => [
  { value: "0", label: "٠ كلمات" },
  { value: "1", label: "كلمة واحدة" },
  { value: "2", label: "كلمتان" },
  { value: "3", label: "٣ كلمات" },
];
const phone = (): ProgramChoice[] => PHONE_DEFAULT_CHOICES.map(choice => ({ ...choice }));
const parents = (): ProgramChoice[] =>
  PARENTS_DEFAULT_CHOICES.map(choice => ({ ...choice }));

export const DEFAULT_PROGRAM_ITEMS: ProgramItem[] = [
  {
    key: "evening-dhikr",
    title: "أذكار المساء",
    category: "worship",
    hint: "أذكار المساء",
    response: "yesno",
    choices: yesNo(),
    enabled: true,
  },
  {
    key: "istighfar",
    title: "٣٣ استغفارًا",
    category: "worship",
    hint: "أستغفر الله وأتوب إليه",
    response: "yesno",
    choices: yesNo(),
    enabled: true,
  },
  {
    key: "salawat",
    title: "٣٣ صلاة على النبي ﷺ",
    category: "worship",
    hint: "اللهم صلِّ وسلم على نبينا محمد",
    response: "yesno",
    choices: yesNo(),
    enabled: true,
  },
  {
    key: "tahlil",
    title: "٣٣ مرة: لا إله إلا الله",
    category: "worship",
    hint: "لا إله إلا الله",
    response: "yesno",
    choices: yesNo(),
    enabled: true,
  },
  {
    key: "sleep-adhkar",
    title: "دعاء النوم وآية الكرسي والمعوذات",
    category: "worship",
    hint: "قبل النوم",
    response: "yesno",
    choices: yesNo(),
    enabled: true,
  },
  {
    key: "fajr",
    title: "صلاة الفجر مع ركعتين",
    category: "worship",
    hint: "صلاة الفجر وسنتها",
    response: "yesno",
    choices: yesNo(),
    enabled: true,
  },
  {
    key: "quran",
    title: "صفحتان من القرآن الكريم",
    category: "worship",
    hint: "وردك القرآني اليوم",
    response: "yesno",
    choices: yesNo(),
    enabled: true,
  },
  {
    key: "story",
    title: "قراءة قصة اليوم",
    category: "learning",
    hint: "قصة اليوم",
    response: "yesno",
    choices: yesNo(),
    enabled: true,
  },
  {
    key: "study",
    title: "الدراسة",
    category: "learning",
    hint: "من ساعة إلى ٣ ساعات",
    response: "study",
    choices: study(),
    enabled: true,
  },
  {
    key: "words",
    title: "حفظ كلمات أجنبية",
    category: "learning",
    hint: "الهدف: ٣ كلمات",
    response: "words",
    choices: words(),
    enabled: true,
  },
  {
    key: FOCUS_ACTIVITY_KEYS.phone,
    title: "وقت اللعب على الجوال",
    category: "home",
    hint: "٣٠ دقيقة وأقل أخضر، ٣١–٩٠ أصفر، وأكثر من ٩٠ أحمر",
    response: "phone",
    choices: phone(),
    enabled: true,
  },
  {
    key: FOCUS_ACTIVITY_KEYS.parents,
    title: "بر الوالدين",
    category: "home",
    hint: "عمل طيب اليوم",
    response: "yesno",
    choices: parents(),
    enabled: true,
  },
];

function normalizeChoice(
  choices: readonly ProgramChoice[],
  defaultChoice: ProgramChoice,
  oldValue: string | undefined,
  oldLabel: string,
  legacyConfiguration: boolean
): ProgramChoice {
  const existing =
    choices.find(choice => choice.value === defaultChoice.value) ??
    (oldValue ? choices.find(choice => choice.value === oldValue) : undefined);
  if (!existing) return { ...defaultChoice };

  const updateLegacyLabel =
    legacyConfiguration && existing.label === oldLabel;
  return {
    ...defaultChoice,
    ...existing,
    value: defaultChoice.value,
    label: updateLegacyLabel ? defaultChoice.label : existing.label,
    tone: existing.tone ?? defaultChoice.tone,
  };
}

export function normalizeProgramItems(
  items: readonly ProgramItem[]
): ProgramItem[] {
  return items.map(item => {
    if (item.key === FOCUS_ACTIVITY_KEYS.parents) {
      const isLegacyConfiguration = !item.choices.some(
        choice => choice.value === PARENTS_ANSWER_VALUES.satisfactory
      );
      const legacyLabels: Record<string, string> = {
        [PARENTS_ANSWER_VALUES.dutiful]: "أنجزت",
        [PARENTS_ANSWER_VALUES.partial]: "لم أنجز",
      };
      return {
        ...item,
        choices: PARENTS_DEFAULT_CHOICES.map(choice =>
          normalizeChoice(
            item.choices,
            choice,
            undefined,
            legacyLabels[choice.value] ?? "",
            isLegacyConfiguration
          )
        ),
      };
    }

    if (item.key === FOCUS_ACTIVITY_KEYS.phone) {
      const isLegacyConfiguration = item.choices.some(
        choice =>
          choice.value === PHONE_ANSWER_VALUES.legacy30to60 ||
          choice.value === PHONE_ANSWER_VALUES.legacyOver60
      );
      const oldValues = [
        undefined,
        PHONE_ANSWER_VALUES.legacy30to60,
        PHONE_ANSWER_VALUES.legacyOver60,
      ];
      const oldLabels = [
        "أقل من ٣٠ دقيقة",
        "٣٠–٦٠ دقيقة",
        "أكثر من ساعة",
      ];
      return {
        ...item,
        hint:
          item.hint === "من نصف ساعة إلى ساعة"
            ? "٣٠ دقيقة وأقل أخضر، ٣١–٩٠ أصفر، وأكثر من ٩٠ أحمر"
            : item.hint,
        choices: PHONE_DEFAULT_CHOICES.map((choice, index) =>
          normalizeChoice(
            item.choices,
            choice,
            oldValues[index],
            oldLabels[index],
            isLegacyConfiguration
          )
        ),
      };
    }

    return item;
  });
}

export const CATEGORY_LABELS: Record<ProgramItem["category"], string> = {
  worship: "العبادة والقرآن",
  learning: "التعلّم",
  home: "في البيت",
};
