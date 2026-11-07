import express from "express";
import app from "./dist/vercel-entry.js";

const handler = express();
handler.use(app);

export default handler;
