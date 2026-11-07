import { parse as parseCookieHeader } from "cookie";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { COOKIE_NAME } from "@shared/const";
import type { User } from "../../drizzle/schema";
import { getAuthAccountByUserId, getUserById } from "../db";
import { verifySessionToken } from "../auth";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  const cookieHeader = opts.req.headers.cookie ?? "";
  const token = parseCookieHeader(cookieHeader)[COOKIE_NAME];
  const session = await verifySessionToken(token);
  let user: User | null = null;

  if (session) {
    const [account, databaseUser] = await Promise.all([
      getAuthAccountByUserId(session.userId),
      getUserById(session.userId),
    ]);
    if (account && databaseUser && account.tokenVersion === session.tokenVersion) {
      user = databaseUser;
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
