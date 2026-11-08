import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROGRAM_ITEMS,
  hasSameChoiceValues,
  isGradeForStage,
  type ProgramStage,
} from "../shared/program";

type GradeCase = {
  stage: ProgramStage;
  grade: string;
  expected: boolean;
};

const gradeCases: GradeCase[] = [
  { stage: "primary", grade: "1", expected: true },
  { stage: "primary", grade: "9", expected: false },
  { stage: "middle", grade: "1", expected: false },
  { stage: "middle", grade: "9", expected: true },
  { stage: "middle", grade: "10", expected: false },
];

describe("student stage and grade", () => {
  it.each(gradeCases)(
    "returns $expected for $stage grade $grade",
    ({ stage, grade, expected }) => {
      expect(isGradeForStage(stage, grade)).toBe(expected);
    }
  );
});

describe("program choice identity", () => {
  const studyChoices = DEFAULT_PROGRAM_ITEMS.find(
    item => item.key === "study"
  )!.choices;

  it("allows label changes while keeping the exact internal value set", () => {
    expect(
      hasSameChoiceValues(
        studyChoices.map(choice => ({ ...choice, label: `مخصص: ${choice.label}` })),
        studyChoices
      )
    ).toBe(true);
  });

  it("rejects comma-collision values and duplicates", () => {
    expect(
      hasSameChoiceValues(
        [
          { value: "1h", label: "ساعة" },
          { value: "2h", label: "ساعتان" },
          { value: "3h,less1", label: "قيمة غير معتمدة" },
        ],
        studyChoices
      )
    ).toBe(false);
    expect(
      hasSameChoiceValues(
        [
          { value: "1h", label: "ساعة" },
          { value: "1h", label: "مكرر" },
          ...studyChoices.slice(2),
        ],
        studyChoices
      )
    ).toBe(false);
  });
});
