import { describe, expect, it } from "vitest";
import { summarizeFocusActivities } from "../shared/focus-statistics";

const categoryCounts = (categories: { value: string; count: number }[]) =>
  Object.fromEntries(categories.map(category => [category.value, category.count]));

describe("focused admin activity statistics", () => {
  it("groups current choices and preserves old phone ranges separately", () => {
    const result = summarizeFocusActivities([
      { answers: { parents: "done", phone: "under30" } },
      { answers: { parents: "satisfactory", phone: "31to90" } },
      { answers: { parents: "missed", phone: "over90" } },
      { answers: { parents: "custom", phone: "30to60" } },
      { answers: { phone: "over60" } },
      { answers: {} },
    ]);

    expect(result.recordCount).toBe(6);
    expect(categoryCounts(result.parents.categories)).toEqual({
      done: 1,
      satisfactory: 1,
      missed: 1,
    });
    expect(result.parents).toMatchObject({
      unrecognized: 1,
      missing: 2,
      answered: 3,
      completionPercent: 33,
    });
    expect(categoryCounts(result.phone.categories)).toEqual({
      under30: 1,
      "31to90": 1,
      over90: 1,
    });
    expect(result.phone.legacy).toEqual([
      { value: "30to60", label: "٣٠–٦٠ دقيقة (تصنيف سابق)", count: 1 },
      { value: "over60", label: "أكثر من ساعة (تصنيف سابق)", count: 1 },
    ]);
    expect(result.phone).toMatchObject({
      unrecognized: 0,
      missing: 1,
      answered: 3,
      targetPercent: 67,
    });
  });

  it("uses configured answer labels and tones in the aggregate", () => {
    const programItems = [
      {
        key: "parents",
        title: "بر الوالدين",
        category: "home" as const,
        hint: "",
        response: "yesno" as const,
        enabled: true,
        choices: [
          { value: "done", label: "متميز", tone: "yellow" as const },
          { value: "satisfactory", label: "جيد", tone: "green" as const },
          { value: "missed", label: "بحاجة لتحسن", tone: "red" as const },
        ],
      },
    ];
    const result = summarizeFocusActivities(
      [{ answers: { parents: "done" } }],
      programItems
    );

    expect(result.parents.categories[0]).toEqual({
      value: "done",
      label: "متميز",
      tone: "yellow",
      count: 1,
    });
  });

  it("returns empty distributions for an empty filtered result", () => {
    const result = summarizeFocusActivities([]);

    expect(result).toMatchObject({
      recordCount: 0,
      parents: {
        unrecognized: 0,
        missing: 0,
        answered: 0,
        completionPercent: null,
      },
      phone: {
        unrecognized: 0,
        missing: 0,
        answered: 0,
        targetPercent: null,
      },
    });
    expect(result.parents.categories.every(category => category.count === 0)).toBe(true);
    expect(result.phone.categories.every(category => category.count === 0)).toBe(true);
    expect(result.phone.legacy.every(category => category.count === 0)).toBe(true);
  });
});
