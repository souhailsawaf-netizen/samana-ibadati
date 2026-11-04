import { describe, expect, it } from "vitest";
import { isGradeForStage, type ProgramStage } from "../shared/program";

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
