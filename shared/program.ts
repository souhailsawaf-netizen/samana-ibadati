export type ProgramStage = "primary" | "middle";
export type AnswerValue = string;
export type ProgramChoice = { value: string; label: string };

export type ProgramItem = {
  key: string;
  title: string;
  category: "worship" | "learning" | "home";
  hint: string;
  response: "yesno" | "study" | "words" | "phone";
  choices: ProgramChoice[];
  enabled: boolean;
};

export type GoalTask = { id: string; title: string; done: boolean };

const yesNo = (): ProgramChoice[] => [{ value: "done", label: "أنجزت" }, { value: "missed", label: "لم أنجز" }];
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
const phone = (): ProgramChoice[] => [
  { value: "under30", label: "أقل من ٣٠ دقيقة" },
  { value: "30to60", label: "٣٠–٦٠ دقيقة" },
  { value: "over60", label: "أكثر من ساعة" },
];

export const DEFAULT_PROGRAM_ITEMS: ProgramItem[] = [
  { key: "evening-dhikr", title: "أذكار المساء", category: "worship", hint: "أذكار المساء", response: "yesno", choices: yesNo(), enabled: true },
  { key: "istighfar", title: "٣٣ استغفارًا", category: "worship", hint: "أستغفر الله وأتوب إليه", response: "yesno", choices: yesNo(), enabled: true },
  { key: "salawat", title: "٣٣ صلاة على النبي ﷺ", category: "worship", hint: "اللهم صلِّ وسلم على نبينا محمد", response: "yesno", choices: yesNo(), enabled: true },
  { key: "tahlil", title: "٣٣ مرة: لا إله إلا الله", category: "worship", hint: "لا إله إلا الله", response: "yesno", choices: yesNo(), enabled: true },
  { key: "sleep-adhkar", title: "دعاء النوم وآية الكرسي والمعوذات", category: "worship", hint: "قبل النوم", response: "yesno", choices: yesNo(), enabled: true },
  { key: "fajr", title: "صلاة الفجر مع ركعتين", category: "worship", hint: "صلاة الفجر وسنتها", response: "yesno", choices: yesNo(), enabled: true },
  { key: "quran", title: "صفحتان من القرآن الكريم", category: "worship", hint: "وردك القرآني اليوم", response: "yesno", choices: yesNo(), enabled: true },
  { key: "story", title: "قراءة قصة اليوم", category: "learning", hint: "قصة اليوم", response: "yesno", choices: yesNo(), enabled: true },
  { key: "study", title: "الدراسة", category: "learning", hint: "من ساعة إلى ٣ ساعات", response: "study", choices: study(), enabled: true },
  { key: "words", title: "حفظ كلمات أجنبية", category: "learning", hint: "الهدف: ٣ كلمات", response: "words", choices: words(), enabled: true },
  { key: "phone", title: "وقت اللعب على الجوال", category: "home", hint: "من نصف ساعة إلى ساعة", response: "phone", choices: phone(), enabled: true },
  { key: "parents", title: "بر الوالدين", category: "home", hint: "عمل طيب اليوم", response: "yesno", choices: yesNo(), enabled: true },
];

export const CATEGORY_LABELS: Record<ProgramItem["category"], string> = {
  worship: "العبادة والقرآن",
  learning: "التعلّم",
  home: "في البيت",
};
