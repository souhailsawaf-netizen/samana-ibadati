import { describe, expect, it } from "vitest";
import { summarizeFocusActivities } from "../shared/focus-statistics";

describe("focused admin activity statistics", () => {
  it("counts known, missing, and unrecognized answers separately", () => {
    const result = summarizeFocusActivities([
      { answers: { parents: "done", phone: "under30" } },
      { answers: { parents: "missed", phone: "30to60" } },
      { answers: { parents: "custom", phone: "over60" } },
      { answers: {} },
      { answers: null },
    ]);

    expect(result).toEqual({
      recordCount: 5,
      parents: {
        done: 1,
        missed: 1,
        unrecognized: 1,
        missing: 2,
        answered: 2,
        completionPercent: 50,
      },
      phone: {
        under30: 1,
        withinTarget: 1,
        over60: 1,
        unrecognized: 0,
        missing: 2,
        answered: 3,
        targetPercent: 33,
      },
    });
  });

  it("returns zero counts for an empty filtered result", () => {
    expect(summarizeFocusActivities([])).toEqual({
      recordCount: 0,
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
    });
  });
});
