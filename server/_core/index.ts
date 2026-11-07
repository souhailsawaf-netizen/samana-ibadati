import "dotenv/config";
import { createServer } from "node:http";
import app from "./app";
import { serveStatic } from "./static";

export { app };
export default app;

if (process.env.VERCEL !== "1") {
  const server = createServer(app);
  const port = Number(process.env.PORT || "3000");
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("Invalid PORT");
  }

  if (process.env.NODE_ENV === "development") {
    void import("./vite").then(({ setupVite }) => setupVite(app, server)).then(() => {
      server.listen(port, "0.0.0.0", () =>
        console.log(`Server listening on port ${port}`)
      );
    }).catch(error => {
      console.error("Development server failed:", error);
      process.exit(1);
    });
  } else {
    serveStatic(app);
    server.listen(port, "0.0.0.0", () =>
      console.log(`Server listening on port ${port}`)
    );
  }
}
