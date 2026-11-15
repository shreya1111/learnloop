import "dotenv/config";
import mongoose from "mongoose";
import { connectDatabase } from "./config/database.js";
import { ensureDevDatabase } from "./config/devDatabase.js";
import { loadConfig } from "./config/env.js";
import { createApp } from "./app.js";

async function startServer() {
  const config = loadConfig();
  console.log(
    `LearnLoop API config: env=${config.nodeEnv} clientOrigin=${config.clientOrigin} cookies=${config.cookieSameSite} trustProxy=${config.trustProxy}`,
  );
  await ensureDevDatabase({
    mongoUri: config.mongoUri,
    nodeEnv: config.nodeEnv,
    autoStart: process.env.DEV_DATABASE_AUTOSTART !== "off",
  });
  await connectDatabase(config.mongoUri);
  const app = createApp({ config });
  const server = app.listen(config.port, () => {
    console.log(`LearnLoop API listening on http://localhost:${config.port}`);
  });

  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`Received ${signal}; shutting down gracefully`);
    const timeout = setTimeout(() => {
      console.error("Graceful shutdown timed out; closing active connections");
      server.closeAllConnections();
    }, 10000);
    timeout.unref();
    server.close(async (error) => {
      clearTimeout(timeout);
      if (error) {
        console.error("HTTP server shutdown failed:", error.message);
        process.exitCode = 1;
      }
      try {
        await mongoose.disconnect();
      } catch (disconnectError) {
        console.error("Database shutdown failed:", disconnectError.message);
        process.exitCode = 1;
      }
    });
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

startServer().catch((error) => {
  console.error("API startup failed:", error.message);
  process.exitCode = 1;
});
