import type { CookieOptions, Request } from "express";

const MANUS_PREVIEW_SUFFIXES = [
  ".manuspre.computer",
  ".manus.computer",
  ".manus-asia.computer",
  ".manuscomputer.ai",
  ".manusvm.computer",
];

export function getSessionCookieOptions(req: Request): CookieOptions {
  const host = String(req.headers["x-forwarded-host"] ?? req.headers.host ?? "")
    .split(",")[0]
    .trim()
    .toLowerCase();
  const isManusPreview = MANUS_PREVIEW_SUFFIXES.some(suffix => host.endsWith(suffix));
  const forwardedProtocol = String(req.headers["x-forwarded-proto"] ?? "")
    .split(",")[0]
    .trim()
    .toLowerCase();
  const secure =
    isManusPreview ||
    process.env.VERCEL === "1" ||
    forwardedProtocol === "https" ||
    req.secure;

  return {
    httpOnly: true,
    path: "/",
    sameSite: isManusPreview ? "none" : "lax",
    secure,
  };
}
