import app from "./app";
import { logger } from "./lib/logger";
import { startBot, stopBot } from "./bot";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Start the Telegram bot
  try {
    startBot();
  } catch (err) {
    logger.error({ err }, "Failed to start Telegram bot");
    process.exit(1);
  }
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  logger.info("SIGTERM received, shutting down");
  await stopBot();
  process.exit(0);
});
