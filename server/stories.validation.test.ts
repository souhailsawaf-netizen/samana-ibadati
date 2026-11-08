import { describe, expect, it } from "vitest";
import { DAILY_STORIES, dailyStoriesSchema } from "../shared/stories";

describe("editable daily stories", () => {
  it("accepts the complete default story set", () => {
    expect(dailyStoriesSchema.safeParse(DAILY_STORIES).success).toBe(true);
  });

  it.each([
    ["a missing story", DAILY_STORIES.slice(1)],
    [
      "a blank title",
      DAILY_STORIES.map((story, index) =>
        index === 0 ? { ...story, title: "  " } : story
      ),
    ],
    [
      "an oversized body",
      DAILY_STORIES.map((story, index) =>
        index === 0 ? { ...story, body: "x".repeat(1001) } : story
      ),
    ],
  ])("rejects %s", (_description, stories) => {
    expect(dailyStoriesSchema.safeParse(stories).success).toBe(false);
  });

  it("trims editable text before it is persisted", () => {
    const stories = DAILY_STORIES.map((story, index) =>
      index === 0 ? { ...story, title: `  ${story.title}  ` } : story
    );

    const result = dailyStoriesSchema.safeParse(stories);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data[0]?.title).toBe(DAILY_STORIES[0]?.title);
    }
  });
});
