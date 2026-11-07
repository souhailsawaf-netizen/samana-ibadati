import { describe, expect, it } from "vitest";
import { getAnswerIndicator } from "../shared/program";

describe("student answer indicators", () => {
  it.each([
    ["parents", "done", "green", "أنجزت بر الوالدين"],
    ["parents", "missed", "red", "لم أنجز بر الوالدين"],
    ["phone", "under30", "yellow", "وقت الجوال أقل من المدة المستهدفة"],
    ["phone", "30to60", "green", "وقت الجوال ضمن المدة المستهدفة"],
    ["phone", "over60", "red", "وقت الجوال تجاوز ساعة"],
  ] as const)("maps %s=%s to %s", (key, value, tone, label) => {
    expect(getAnswerIndicator(key, value)).toEqual({ tone, label });
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
