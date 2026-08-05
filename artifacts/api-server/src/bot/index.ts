import TelegramBot from "node-telegram-bot-api";
import { logger } from "../lib/logger";
import { registerHandlers } from "./handlers";

let botInstance: TelegramBot | null = null;

export function startBot(): TelegramBot {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN environment variable is required");
  }

  const bot = new TelegramBot(token, { polling: true });
  botInstance = bot;

  // Set bot commands for BotFather menu
  bot.setMyCommands([
    { command: "start", description: "Start the bot and show main menu" },
  ]).catch((err) => {
    logger.warn({ err }, "Failed to set bot commands");
  });

  registerHandlers(bot);

  bot.on("polling_error", (err) => {
    logger.error({ err }, "Telegram polling error");
  });

  bot.on("error", (err) => {
    logger.error({ err }, "Telegram bot error");
  });

  logger.info("Telegram bot started (polling mode)");
  return bot;
}

export function stopBot(): Promise<void> {
  if (botInstance) {
    return botInstance.stopPolling();
  }
  return Promise.resolve();
}
