import express from "express";
import { sql } from "drizzle-orm";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { getDb } from "../db";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic } from "./static";

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});

function hasSameOrigin(req: express.Request): boolean {
  const origin = req.get("origin");
  if (!origin) return req.get("sec-fetch-site") === "same-origin";
  const requestHost = String(req.headers["x-forwarded-host"] ?? req.get("host") ?? "")
    .split(",")[0]
    .trim()
    .toLowerCase();
  const requestProtocol = String(
    req.headers["x-forwarded-proto"] ?? req.protocol ?? ""
  )
    .split(",")[0]
    .trim()
    .toLowerCase();
  try {
    const parsed = new URL(origin);
    return (
      parsed.host.toLowerCase() === requestHost &&
      parsed.protocol.replace(":", "") === requestProtocol
    );
  } catch {
    return false;
  }
}

app.use("/api/trpc", (req, res, next) => {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method) && !hasSameOrigin(req)) {
    res.status(403).json({ error: "Cross-origin request rejected" });
    return;
  }
  next();
});

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ limit: "1mb", extended: true }));
app.get("/api/health", async (_req, res) => {
  try {
    const db = await getDb();
    if (!db) throw new Error("Database is not configured");
    await db.execute(sql`select 1`);
    res.json({ status: "ok" });
  } catch {
    res.status(503).json({ status: "unavailable" });
  }
});

app.use(
  "/api/trpc",
  createExpressMiddleware({ router: appRouter, createContext })
);

if (process.env.VERCEL === "1") {
  serveStatic(app);
}

export { app };
export default app;
