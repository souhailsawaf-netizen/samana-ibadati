import express, { type Express } from "express";
import fs from "node:fs";
import path from "node:path";

export function serveStatic(app: Express) {
  const distPath =
    process.env.VERCEL === "1"
      ? path.resolve(process.cwd(), "dist", "public")
      : path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(`Build directory not found: ${distPath}`);
  }

  app.use(express.static(distPath, { index: false }));
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Not Found" });
  });
  app.get("/404", (_req, res) => {
    res.status(404).sendFile(path.resolve(distPath, "index.html"));
  });
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
