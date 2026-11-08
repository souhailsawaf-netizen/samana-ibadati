import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROGRAM_ITEMS,
  FOCUS_ACTIVITY_KEYS,
  getProgramDoneCount,
  getAnswerIndicator,
  isProgramItemComplete,
  normalizeProgramItems,
  PHONE_ANSWER_VALUES,
  PARENTS_ANSWER_VALUES,
} from "../shared/program";

describe("student answer indicators", () => {
  it.each([
    ["parents", PARENTS_ANSWER_VALUES.dutiful, "green", "بار"],
    ["parents", PARENTS_ANSWER_VALUES.satisfactory, "yellow", "مرضي جيد"],
    ["parents", PARENTS_ANSWER_VALUES.partial, "red", "مرضي قليلا"],
    ["phone", PHONE_ANSWER_VALUES.under30, "green", "٣٠ دقيقة وأقل"],
    ["phone", PHONE_ANSWER_VALUES.within90, "yellow", "٣١–٩٠ دقيقة"],
    ["phone", PHONE_ANSWER_VALUES.over90, "red", "أكثر من ٩٠ دقيقة"],
  ] as const)("maps %s=%s to %s", (key, value, tone, label) => {
    expect(getAnswerIndicator(key, value)).toEqual({ tone, label });
  });

  it.each([
    ["phone", PHONE_ANSWER_VALUES.legacy30to60, "٣٠–٦٠ دقيقة (تصنيف سابق)"],
    ["phone", PHONE_ANSWER_VALUES.legacyOver60, "أكثر من ساعة (تصنيف سابق)"],
  ] as const)("keeps legacy %s=%s neutral", (key, value, label) => {
    expect(getAnswerIndicator(key, value)).toEqual({ tone: "neutral", label });
  });

  it.each([
    ["parents", undefined],
    ["phone", undefined],
    ["study", "1h"],
    ["parents", "unknown"],
  ] as const)("leaves %s=%s without a colored indicator", (key, value) => {
    expect(getAnswerIndicator(key, value)).toBeNull();
  });
});

describe("program choice compatibility", () => {
  it("upgrades stored focus choices while retaining old phone values for history", () => {
    const legacyItems = DEFAULT_PROGRAM_ITEMS.map(item => {
      if (item.key === FOCUS_ACTIVITY_KEYS.parents) {
        return {
          ...item,
          choices: [
            { value: "done", label: "أنجزت" },
            { value: "missed", label: "لم أنجز" },
          ],
        };
      }
      if (item.key === FOCUS_ACTIVITY_KEYS.phone) {
        return {
          ...item,
          hint: "من نصف ساعة إلى ساعة",
          choices: [
            { value: "under30", label: "أقل من ٣٠ دقيقة" },
            { value: "30to60", label: "٣٠–٦٠ دقيقة" },
            { value: "over60", label: "أكثر من ساعة" },
          ],
        };
      }
      return item;
    });

    const normalized = normalizeProgramItems(legacyItems);
    const parents = normalized.find(
      item => item.key === FOCUS_ACTIVITY_KEYS.parents
    );
    const phone = normalized.find(
      item => item.key === FOCUS_ACTIVITY_KEYS.phone
    );

    expect(parents?.choices).toEqual([
      { value: "done", label: "بار", tone: "green" },
      { value: "satisfactory", label: "مرضي جيد", tone: "yellow" },
      { value: "missed", label: "مرضي قليلا", tone: "red" },
    ]);
    expect(phone?.choices).toEqual([
      { value: "under30", label: "٣٠ دقيقة وأقل", tone: "green" },
      { value: "31to90", label: "٣١–٩٠ دقيقة", tone: "yellow" },
      { value: "over90", label: "أكثر من ٩٠ دقيقة", tone: "red" },
    ]);
    expect(phone?.hint).toContain("٣١–٩٠");
    expect(
      getAnswerIndicator("phone", "over60", phone?.choices)
    ).toMatchObject({ tone: "neutral" });
  });

  it("preserves supervisor-edited labels and colors after normalization", () => {
    const customized = normalizeProgramItems(DEFAULT_PROGRAM_ITEMS).map(item =>
      item.key === FOCUS_ACTIVITY_KEYS.parents
        ? {
            ...item,
            choices: item.choices.map(choice =>
              choice.value === "satisfactory"
                ? { ...choice, label: "تقدم جيد", tone: "green" as const }
                : choice
            ),
          }
        : item
    );

    expect(
      normalizeProgramItems(customized).find(
        item => item.key === FOCUS_ACTIVITY_KEYS.parents
      )?.choices[1]
    ).toEqual({ value: "satisfactory", label: "تقدم جيد", tone: "green" });
  });
});

describe("daily completion history", () => {
  const phone = DEFAULT_PROGRAM_ITEMS.find(
    item => item.key === FOCUS_ACTIVITY_KEYS.phone
  )!;

  it("keeps legacy 30–60 minute answers complete in history only", () => {
    const answers = { [phone.key]: PHONE_ANSWER_VALUES.legacy30to60 };
    expect(isProgramItemComplete(phone, answers[phone.key])).toBe(false);
    expect(
      getProgramDoneCount([phone], answers, {
        preserveLegacyPhoneAnswers: true,
      })
    ).toBe(1);
    expect(
      getProgramDoneCount(
        [phone],
        { [phone.key]: PHONE_ANSWER_VALUES.legacyOver60 },
        { preserveLegacyPhoneAnswers: true }
      )
    ).toBe(0);
  });
});
