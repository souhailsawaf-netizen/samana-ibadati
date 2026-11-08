import { z } from "zod";
import { DAILY_STORIES } from "./stories.data";

const dailyStorySchema = z.object({
  title: z.string().trim().min(2).max(120),
  body: z.string().trim().min(2).max(1000),
  takeaway: z.string().trim().min(2).max(240),
});

export type DailyStory = z.infer<typeof dailyStorySchema>;

export { DAILY_STORIES };

export const dailyStoriesSchema = z
  .array(dailyStorySchema)
  .length(DAILY_STORIES.length, "عدد القصص يجب أن يبقى ثابتًا.");
