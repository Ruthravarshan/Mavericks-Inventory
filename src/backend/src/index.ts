import "dotenv/config";
import cron from "node-cron";
import app from "./app.js";
import logger from "./lib/logger.js";
import { runAnomalyDetection } from "./lib/anomaly-engine.js";

const PORT = Number(process.env.PORT ?? 8080);

// ─── Start server ─────────────────────────────────────────────────────────────

const server = app.listen(PORT, () => {
  logger.info(
    {
      port: PORT,
      env: process.env.NODE_ENV ?? "development",
      azureOpenAI: !!process.env.AZURE_OPENAI_ENDPOINT,
      azureBlob: !!process.env.AZURE_STORAGE_CONNECTION_STRING,
      azureSearch: !!process.env.AZURE_SEARCH_ENDPOINT,
    },
    `Mavericks Inventory Backend started on port ${PORT}`
  );
});

// ─── Anomaly detection cron (every 15 minutes) ───────────────────────────────

cron.schedule("*/15 * * * *", async () => {
  logger.info("Running scheduled anomaly detection");
  await runAnomalyDetection();
});

// Run once on startup (after 5s to let DB settle)
setTimeout(() => {
  runAnomalyDetection().catch((err) =>
    logger.error({ err }, "Initial anomaly detection failed")
  );
}, 5000);

// ─── Graceful shutdown ────────────────────────────────────────────────────────

function gracefulShutdown(signal: string) {
  logger.info({ signal }, "Received shutdown signal");

  server.close((err) => {
    if (err) {
      logger.error({ err }, "Error during server close");
      process.exit(1);
    }

    import("./db/index.js")
      .then(({ pool }) => pool.end())
      .then(() => {
        logger.info("Database pool closed");
        process.exit(0);
      })
      .catch((err) => {
        logger.error({ err }, "Error closing database pool");
        process.exit(1);
      });
  });

  // Force exit after 15s
  setTimeout(() => {
    logger.error("Forced shutdown after timeout");
    process.exit(1);
  }, 15000);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Unhandled promise rejection");
});

process.on("uncaughtException", (err) => {
  logger.error({ err }, "Uncaught exception");
  process.exit(1);
});
