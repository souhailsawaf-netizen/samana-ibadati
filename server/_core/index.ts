import "dotenv/config";
import { createServer } from "node:http";
import { closeDbPool } from "../db";
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

  const listen = () => {
    server.listen(port, "0.0.0.0", () => {
      console.log(`Server listening on port ${port}`);
      registerShutdownHandlers();
    });
  };

  function registerShutdownHandlers() {
    let shuttingDown = false;
    const shutdown = (signal: NodeJS.Signals) => {
      if (shuttingDown) return;
      shuttingDown = true;
      console.log(`Received ${signal}; closing HTTP server`);
      server.close(error => {
        if (error) {
          process.exitCode = 1;
          console.error("Failed to close HTTP server:", error);
        }
        void closeDbPool().catch(poolError => {
          process.exitCode = 1;
          console.error("Failed to close database pool:", poolError);
        });
      });
    };

    process.once("SIGTERM", () => shutdown("SIGTERM"));
    process.once("SIGINT", () => shutdown("SIGINT"));
  }

  if (process.env.NODE_ENV === "development") {
    void import("./vite")
      .then(({ setupVite }) => setupVite(app, server))
      .then(listen)
      .catch(error => {
        console.error("Development server failed:", error);
        process.exit(1);
      });
  } else {
    serveStatic(app);
    listen();
  }
}
