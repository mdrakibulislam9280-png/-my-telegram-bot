import TelegramBot from "node-telegram-bot-api";
import { logger } from "../lib/logger";
import {
  getAvailableCountries,
  buyNumber,
  cancelOrder,
} from "./fivesim";
import { formatCountry, toDisplayName } from "./countries";
import { getState, setState, clearOrderState } from "./state";
import { getOrCreateWallet } from "./wallet";
import { getReferralCode, getReferralStats, processReferral } from "./referral";
import { checkMembership, sendJoinPrompt } from "./membership";

// ─── Constants ────────────────────────────────────────────────────────────────

const SERVICES: { label: string; code: string }[] = [
  { label: "🇫 FACEBOOK", code: "facebook" },
  { label: "🟢 INSTAGRAM", code: "instagram" },
  { label: "🖤 TIKTOK", code: "tiktok" },
];

// ─── Keyboards ────────────────────────────────────────────────────────────────

function mainMenuKeyboard(): TelegramBot.ReplyKeyboardMarkup {
  return {
    keyboard: [
      [{ text: "📱 GET NUMBER" }, { text: "📊 TRAFFIC" }],
      [{ text: "💰 BALANCE" }, { text: "🆘 SUPPORT" }],
      [{ text: "🆕 আমি নতুন" }, { text: "🎁 REFER" }],
    ],
    resize_keyboard: true,
    one_time_keyboard: false,
  };
}

function serviceMenuKeyboard(): TelegramBot.InlineKeyboardMarkup {
  const rows = SERVICES.map((s) => [
    { text: s.label, callback_data: `service:${s.code}` },
  ]);
  rows.push([{ text: "❌ Close", callback_data: "close_service_menu" }]);
  return { inline_keyboard: rows };
}

function countryKeyboard(
  countries: string[],
): TelegramBot.InlineKeyboardMarkup {
  const rows = countries.map((c) => [
    { text: formatCountry(c), callback_data: `country:${c}` },
  ]);
  rows.push([{ text: "⬅️ Back", callback_data: "back_to_services" }]);
  return { inline_keyboard: rows };
}

function cancelOrderKeyboard(
  orderId: number,
): TelegramBot.InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: "❌ Cancel Order", callback_data: `cancel:${orderId}` }],
    ],
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isLowBalanceError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message.toLowerCase() : "";
  return (
    msg.includes("no free phones") ||
    msg.includes("not enough") ||
    msg.includes("balance") ||
    msg.includes("insufficient") ||
    msg.includes("no money") ||
    msg.includes("400") ||
    msg.includes("payment")
  );
}

async function safeSend(
  bot: TelegramBot,
  chatId: number,
  text: string,
  options?: TelegramBot.SendMessageOptions,
): Promise<void> {
  try {
    await bot.sendMessage(chatId, text, options);
  } catch (err) {
    logger.error({ err, chatId }, "Failed to send message");
  }
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

export function registerHandlers(bot: TelegramBot): void {
  // /start command — also handles referral deep links (/start ref_<id>)
  bot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from!.id;
    const param = match?.[1]?.trim();

    // Process referral if a code was passed
    if (param?.startsWith("ref_")) {
      // Ensure referred user has a wallet first
      await getOrCreateWallet(userId);
      const result = await processReferral(userId, param);
      if (result === "credited") {
        await safeSend(
          bot,
          chatId,
          "🎉 *Referral Applied!*\n\nYou joined via a referral link. Your referrer has been rewarded.",
          { parse_mode: "Markdown" },
        );
      }
    }

    await safeSend(
      bot,
      chatId,
      "👋 *Welcome to Rakibul Number Bot!*\n\nChoose an option below:",
      {
        parse_mode: "Markdown",
        reply_markup: mainMenuKeyboard(),
      },
    );
  });

  // Text message handler — main menu routing
  bot.on("message", async (msg) => {
    if (!msg.text || msg.text.startsWith("/")) return;
    const chatId = msg.chat.id;
    const text = msg.text.trim();

    // ── Force-subscription gate ───────────────────────────────────────────────
    const membership = await checkMembership(bot, msg.from!.id);
    if (!membership.joined) {
      await sendJoinPrompt(bot, chatId, membership);
      return;
    }

    if (text === "📱 GET NUMBER") {
      await safeSend(
        bot,
        chatId,
        "📲 *Select a service to get a virtual number:*",
        {
          parse_mode: "Markdown",
          reply_markup: serviceMenuKeyboard(),
        },
      );
      return;
    }

    if (text === "💰 BALANCE") {
      try {
        const wallet = await getOrCreateWallet(msg.from!.id);
        await safeSend(
          bot,
          chatId,
          `💰 *Your Account Balance*\n\n` +
            `👤 User ID: ${msg.from!.id}\n` +
            `💳 Balance: *${parseFloat(wallet.balanceBdt).toFixed(2)} BDT*\n` +
            `📊 Total Orders: ${wallet.totalOrders}\n\n` +
            `💡 To deposit funds into your wallet, please contact support.`,
          { parse_mode: "Markdown", reply_markup: mainMenuKeyboard() },
        );
      } catch (err) {
        logger.error({ err }, "Balance fetch failed");
        await safeSend(
          bot,
          chatId,
          "⚠️ Could not fetch your balance. Please try again later.",
          { reply_markup: mainMenuKeyboard() },
        );
      }
      return;
    }

    if (text === "📊 TRAFFIC") {
      const msg =
        `🔥 *High Traffic & Fast OTP Countries* 🔥\n\n` +
        `🇫 *FACEBOOK:*\n` +
        `• 🇲🇬 Madagascar (Instant OTP ⚡️)\n` +
        `• 🇮🇩 Indonesia (High Success Rate 🔥)\n\n` +
        `🟢 *INSTAGRAM:*\n` +
        `• 🇷🇺 Russia (Instant OTP ⚡️)\n` +
        `• 🇻🇳 Vietnam (High Success Rate 🔥)\n\n` +
        `🖤 *TIKTOK:*\n` +
        `• 🇵🇭 Philippines (Instant OTP ⚡️)\n` +
        `• 🇰🇿 Kazakhstan (High Success Rate 🔥)\n\n` +
        `💡 *Tip:* Use these high-traffic countries for the fastest OTP delivery!`;

      await safeSend(bot, chatId, msg, {
        parse_mode: "Markdown",
        reply_markup: mainMenuKeyboard(),
      });
      return;
    }

    if (text === "🆘 SUPPORT") {
      await safeSend(
        bot,
        chatId,
        "🆘 *Customer Support*\n\n" +
          "If you face any problems, please contact the admin directly:\n\n" +
          "👤 *Direct Admin Contact*",
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "💬 Chat", url: "https://t.me/Rakib_2H" }],
            ],
          },
        },
      );
      return;
    }

    if (text === "🆕 আমি নতুন") {
      await safeSend(bot, chatId, "🚧 This feature is coming soon!", {
        reply_markup: mainMenuKeyboard(),
      });
      return;
    }

    if (text === "🎁 REFER") {
      try {
        const [stats, me] = await Promise.all([
          getReferralStats(msg.from!.id),
          bot.getMe(),
        ]);
        const code = getReferralCode(msg.from!.id);
        const link = `https://t.me/${me.username}?start=${code}`;
        await safeSend(
          bot,
          chatId,
          `🎁 *Your Referral Link*\n\n` +
            `👇 Share this link with your friends:\n\`${link}\`\n\n` +
            `প্রতিটি সঠিক রেফারের জন্য আপনি ০.১০ টাকা করে পাবেন।\n\n` +
            `📊 *Your Referral Stats*\n` +
            `👥 Total Referred: *${stats.referralCount}* users\n` +
            `💵 Total Earned: *${parseFloat(stats.referralEarningsBdt).toFixed(2)} BDT*`,
          { parse_mode: "Markdown", reply_markup: mainMenuKeyboard() },
        );
      } catch (err) {
        logger.error({ err }, "Referral stats fetch failed");
        await safeSend(
          bot,
          chatId,
          "⚠️ Could not fetch your referral info. Please try again later.",
          { reply_markup: mainMenuKeyboard() },
        );
      }
      return;
    }

    // Unknown message — show main menu
    await safeSend(bot, chatId, "Please choose an option from the menu below:", {
      reply_markup: mainMenuKeyboard(),
    });
  });

  // Callback query handler — inline keyboard interactions
  bot.on("callback_query", async (query) => {
    if (!query.data || !query.message) return;
    const chatId = query.message.chat.id;
    const userId = query.from.id;
    const data = query.data;

    // Always acknowledge the callback immediately
    try {
      await bot.answerCallbackQuery(query.id);
    } catch {
      // ignore
    }

    // ── Verify membership ─────────────────────────────────────────────────────
    if (data === "verify_membership") {
      const status = await checkMembership(bot, userId);
      if (status.joined) {
        try {
          await bot.editMessageText("✅ *Verify Successful!*\n\nWelcome! You can now use all features.", {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: "Markdown",
          });
        } catch {
          await safeSend(bot, chatId, "✅ *Verify Successful!* You can now use all features.", {
            parse_mode: "Markdown",
          });
        }
        await safeSend(bot, chatId, "Choose an option below:", {
          reply_markup: mainMenuKeyboard(),
        });
      } else {
        try {
          await bot.editMessageText(
            "❌ *Verification Failed*\n\nYou have not joined all required chats yet. Please join and try again.",
            {
              chat_id: chatId,
              message_id: query.message.message_id,
              parse_mode: "Markdown",
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: "📢 Join Channel", url: "https://t.me/RakibCryptoTech" },
                    { text: "👥 Join Group", url: "https://t.me/Rakibul_Otp_Rcv" },
                  ],
                  [{ text: "✅ Verify", callback_data: "verify_membership" }],
                ],
              },
            },
          );
        } catch {
          await sendJoinPrompt(bot, chatId, status);
        }
      }
      return;
    }

    // ── Service selected ──────────────────────────────────────────────────────
    if (data.startsWith("service:")) {
      const serviceCode = data.slice("service:".length);
      setState(userId, { selectedService: serviceCode });

      const serviceLabel =
        SERVICES.find((s) => s.code === serviceCode)?.label ?? serviceCode;

      try {
        await bot.editMessageText(
          `🔍 Fetching available countries for *${serviceLabel}*…`,
          {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: "Markdown",
          },
        );

        const countries = await getAvailableCountries(serviceCode);

        if (countries.length === 0) {
          await bot.editMessageText(
            `😔 No countries currently have stock for *${serviceLabel}*. Please try again later.`,
            {
              chat_id: chatId,
              message_id: query.message.message_id,
              parse_mode: "Markdown",
              reply_markup: {
                inline_keyboard: [
                  [{ text: "⬅️ Back", callback_data: "back_to_services" }],
                ],
              },
            },
          );
          return;
        }

        await bot.editMessageText(
          `🌍 *Select a country for ${serviceLabel}:*`,
          {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: "Markdown",
            reply_markup: countryKeyboard(countries),
          },
        );
      } catch (err) {
        logger.error({ err }, "Failed to fetch countries");
        await bot.editMessageText(
          "⚠️ Failed to fetch available countries. Please try again.",
          {
            chat_id: chatId,
            message_id: query.message.message_id,
            reply_markup: {
              inline_keyboard: [
                [{ text: "⬅️ Back", callback_data: "back_to_services" }],
              ],
            },
          },
        );
      }
      return;
    }

    // ── Country selected → buy number ─────────────────────────────────────────
    if (data.startsWith("country:")) {
      const country = data.slice("country:".length);
      const state = getState(userId);
      const service = state.selectedService;

      if (!service) {
        await safeSend(bot, chatId, "⚠️ Session expired. Please start over.", {
          reply_markup: mainMenuKeyboard(),
        });
        return;
      }

      try {
        await bot.editMessageText(
          `⏳ Purchasing number in *${formatCountry(country)}*…`,
          {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: "Markdown",
          },
        );

        const order = await buyNumber(country, service);
        setState(userId, { activeOrderId: order.id });

        const serviceLabel =
          SERVICES.find((s) => s.code === service)?.label ?? service;
        const displayCountry = formatCountry(country);

        await bot.editMessageText(
          `✅ *Number Acquired!*\n\n` +
            `📱 Number: \`${order.phone}\`\n` +
            `🌍 Country: ${displayCountry}\n` +
            `📲 Service: ${serviceLabel}\n` +
            `💵 Price: $${order.price.toFixed(2)}\n` +
            `🆔 Order ID: ${order.id}\n\n` +
            `⏳ Waiting for SMS… Forward any code you receive here.`,
          {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: "Markdown",
            reply_markup: cancelOrderKeyboard(order.id),
          },
        );
      } catch (err) {
        logger.error({ err }, "Number purchase failed");

        const userMsg = isLowBalanceError(err)
          ? "⚠️ *Your 5sim account balance is too low.*\n\nPlease recharge your 5sim account at https://5sim.net and try again."
          : "⚠️ *Purchase failed.* The number could not be acquired. Please try a different country or try again later.";

        await bot.editMessageText(userMsg, {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "⬅️ Back", callback_data: "back_to_services" }],
            ],
          },
        });
      }
      return;
    }

    // ── Cancel order ─────────────────────────────────────────────────────────
    if (data.startsWith("cancel:")) {
      const orderId = parseInt(data.slice("cancel:".length), 10);

      try {
        await cancelOrder(orderId);
        clearOrderState(userId);

        await bot.editMessageText(
          `🚫 *Order #${orderId} has been cancelled.*\n\nYou can get a new number from the main menu.`,
          {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: "Markdown",
          },
        );

        await safeSend(bot, chatId, "What would you like to do next?", {
          reply_markup: mainMenuKeyboard(),
        });
      } catch (err) {
        logger.error({ err }, "Cancel order failed");
        await safeSend(
          bot,
          chatId,
          "⚠️ Could not cancel the order. It may have already been cancelled or completed.",
          { reply_markup: mainMenuKeyboard() },
        );
      }
      return;
    }

    // ── Back to service menu ──────────────────────────────────────────────────
    if (data === "back_to_services") {
      await bot.editMessageText("📲 *Select a service to get a virtual number:*", {
        chat_id: chatId,
        message_id: query.message.message_id,
        parse_mode: "Markdown",
        reply_markup: serviceMenuKeyboard(),
      });
      return;
    }

    // ── Close service menu ────────────────────────────────────────────────────
    if (data === "close_service_menu") {
      try {
        await bot.deleteMessage(chatId, query.message.message_id);
      } catch {
        await bot.editMessageText("Menu closed.", {
          chat_id: chatId,
          message_id: query.message.message_id,
        });
      }
      return;
    }
  });
}
