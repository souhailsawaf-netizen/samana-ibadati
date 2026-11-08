import { expect, it } from "vitest";
import { DEFAULT_PROGRAM_ITEMS } from "../shared/program";
import { DAILY_STORIES } from "../shared/stories";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";

const studentContext: TrpcContext = {
  req: {} as TrpcContext["req"],
  res: {} as TrpcContext["res"],
  user: {
    id: 1,
    openId: "student-test",
    name: "طالب اختبار",
    email: null,
    loginMethod: "local",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  },
};

it("rejects a regular user from editing shared program content", async () => {
  const caller = appRouter.createCaller(studentContext);

  await expect(
    caller.admin.saveProgram({
      title: "برنامج اختبار",
      startDate: "",
      endDate: "",
      dailyItems: DEFAULT_PROGRAM_ITEMS,
      dailyStories: DAILY_STORIES,
    })
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
});
