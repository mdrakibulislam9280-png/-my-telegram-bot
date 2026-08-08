import TelegramBot from "node-telegram-bot-api";
import { logger } from "../lib/logger";
import {
  getAvailableCountries,
  buyNumber,
  cancelOrder,
} from "./fivesim";
import { formatCountry, toDisplayName } from "./countries";
import { getState, setState, clearOrderState, clearWithdrawState } from "./state";
import { processWithdrawal, WITHDRAWAL_FEE_BDT, WITHDRAWAL_MIN_BDT } from "./withdrawal";
import { getOrCreateWallet } from "./wallet";
import { getReferralCode, getReferralStats, processReferral } from "./referral";
import { checkMembership, sendJoinPrompt } from "./membership";
import { ADMIN_TELEGRAM_ID } from "../lib/config";

// ─── Constants ────────────────────────────────────────────────────────────────

const const SERVICES: { label: string; code: string }[] = [
  { label: "🔵 Facebook", code: "facebook" },
  { label: "🟣 Instagram", code: "instagram" },
];

const OTHER_SERVICES: { label: string; code: string }[] = [];

/** Lookup label for a service code across both lists. */
function serviceLabel(code: string): string {
  return (
    [...SERVICES, ...OTHER_SERVICES].find((s) => s.code === code)?.label ?? code
  );
}

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
  return {
    inline_keyboard: [
      [
        { text: "🔵 Facebook",  callback_data: "service:facebook" },
        { text: "📸 Instagram", callback_data: "service:instagram" },
      ],
      [
        { text: "🎵 TikTok",   callback_data: "service:tiktok" },
        { text: "🌐 Others",   callback_data: "service_category:others" },
      ],
      [{ text: "❌ Close", callback_data: "close_service_menu" }],
    ],
  };
}

function othersMenuKeyboard(): TelegramBot.InlineKeyboardMarkup {
  const rows: TelegramBot.InlineKeyboardButton[][] = [];
  for (let i = 0; i < OTHER_SERVICES.length; i += 2) {
    rows.push(
      OTHER_SERVICES.slice(i, i + 2).map((s) => ({
        text: s.label,
        callback_data: `service:${s.code}`,
      })),
    );
  }
  rows.push([{ text: "⬅️ Back", callback_data: "back_to_services" }]);
  return { inline_keyboard: rows };
}

function countryKeyboard(
  countries: string[],
): TelegramBot.InlineKeyboardMarkup {
  const rows: TelegramBot.InlineKeyboardButton[][] = [];
  for (let i = 0; i < countries.length; i += 2) {
    rows.push(
      countries.slice(i, i + 2).map((c) => ({
        text: formatCountry(c),
        callback_data: `country:${c}`,
      })),
    );
  }
  rows.push([{ text: "⬅️ Back", callback_data: "back_to_services" }]);
  return { inline_keyboard: rows };
}

function numberAcquiredKeyboard(orderId: number): TelegramBot.InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: "🔄 Change Number",  callback_data: "change_number" },
        { text: "🌍 Change Country", callback_data: "back_to_countries" },
      ],
      [{ text: "👥 Otp Group", url: "https://t.me/Rakibul_Otp_Rcv" }],
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

    // ── Force-subscription gate ───────────────────────────────────────────────
    const membership = await checkMembership(bot, userId);
    if (!membership.joined) {
      await sendJoinPrompt(bot, chatId, membership);
      return;
    }

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

    // ── Withdrawal flow — intercept free-text input ───────────────────────────
    const userState = getState(msg.from!.id);

    if (userState.withdrawStep === "awaiting_account") {
      const method = userState.withdrawMethod!;
      const label = method === "nogod" ? "Nogod" : "Binance USDT BEP20";
      setState(msg.from!.id, { withdrawAccount: text, withdrawStep: "awaiting_amount" });
      await safeSend(
        bot,
        chatId,
        `✅ *${label} account saved.*\n\n` +
          `💵 Now enter the amount you want to withdraw (BDT):\n\n` +
          `📌 Minimum: *${WITHDRAWAL_MIN_BDT} BDT*\n` +
          `📌 Fee: *${WITHDRAWAL_FEE_BDT} BDT* (deducted from your balance)`,
        { parse_mode: "Markdown" },
      );
      return;
    }

    if (userState.withdrawStep === "awaiting_amount") {
      const amount = parseFloat(text.replace(/,/g, ""));
      if (isNaN(amount) || amount <= 0) {
        await safeSend(bot, chatId, "⚠️ Please enter a valid numeric amount.", {});
        return;
      }

      const result = await processWithdrawal(
        msg.from!.id,
        userState.withdrawMethod!,
        userState.withdrawAccount!,
        amount,
      );
      clearWithdrawState(msg.from!.id);

      if (result.ok) {
        const methodLabel = userState.withdrawMethod === "nogod" ? "Nogod" : "Binance USDT BEP20";
        const username = msg.from!.username ? `@${msg.from!.username}` : "N/A";

        // Notify user
        await safeSend(
          bot,
          chatId,
          `💸 *Payment Successful!*\n\n` +
            `📤 Method: *${methodLabel}*\n` +
            `💳 Account: \`${userState.withdrawAccount}\`\n` +
            `💵 Amount: *${amount.toFixed(2)} BDT*\n` +
            `🔻 Fee: *${WITHDRAWAL_FEE_BDT} BDT*\n` +
            `✅ Net Withdrawn: *${amount.toFixed(2)} BDT*`,
          { parse_mode: "Markdown", reply_markup: mainMenuKeyboard() },
        );

        // Notify admin
        if (ADMIN_TELEGRAM_ID) {
          await safeSend(
            bot,
            ADMIN_TELEGRAM_ID,
            `🔔 *New Withdrawal Request*\n\n` +
              `👤 User: ${username}\n` +
              `🆔 Telegram ID: \`${msg.from!.id}\`\n` +
              `📤 Method: *${methodLabel}*\n` +
              `💳 Account: \`${userState.withdrawAccount}\`\n` +
              `💵 Amount: *${amount.toFixed(2)} BDT*\n` +
              `🔻 Fee: *${WITHDRAWAL_FEE_BDT} BDT*\n` +
              `✅ Net to Pay: *${amount.toFixed(2)} BDT*`,
            { parse_mode: "Markdown" },
          );
        } else {
          logger.warn("ADMIN_TELEGRAM_ID is not set — withdrawal notification skipped");
        }
      } else if (result.reason === "below_minimum") {
        await safeSend(
          bot,
          chatId,
          `⚠️ *Minimum withdrawal is ${WITHDRAWAL_MIN_BDT} BDT.*\n\nPlease try again with a higher amount.`,
          { parse_mode: "Markdown", reply_markup: mainMenuKeyboard() },
        );
      } else {
        await safeSend(
          bot,
          chatId,
          `❌ *Insufficient balance.*\n\nYou need at least *${amount + WITHDRAWAL_FEE_BDT} BDT* (amount + ${WITHDRAWAL_FEE_BDT} BDT fee) to complete this withdrawal.`,
          { parse_mode: "Markdown", reply_markup: mainMenuKeyboard() },
        );
      }
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
            `👤 User ID: \`${msg.from!.id}\`\n` +
            `💳 Balance: *${parseFloat(wallet.balanceBdt).toFixed(2)} BDT*\n` +
            `📤 Total Withdrawn: *${parseFloat(wallet.totalWithdrawnBdt).toFixed(2)} BDT*\n` +
            `📊 Total Orders: ${wallet.totalOrders}\n\n` +
            `💡 To deposit funds, please contact support.`,
          {
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [{ text: "💸 Withdraw", callback_data: "withdraw_start" }],
              ],
            },
          },
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

    // ── Withdraw: show payment method selection ───────────────────────────────
    if (data === "withdraw_start") {
      await safeSend(
        bot,
        chatId,
        `💸 *Withdraw Funds*\n\n` +
          `Select your preferred payment method:\n\n` +
          `📌 Minimum: *${WITHDRAWAL_MIN_BDT} BDT*\n` +
          `📌 Fee: *${WITHDRAWAL_FEE_BDT} BDT* per withdrawal`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "🟠 Nogod", callback_data: "withdraw_method:nogod" }],
              [{ text: "🟡 Binance (USDT BEP20)", callback_data: "withdraw_method:binance" }],
              [{ text: "❌ Cancel", callback_data: "withdraw_cancel" }],
            ],
          },
        },
      );
      return;
    }

    // ── Withdraw: payment method chosen ──────────────────────────────────────
    if (data === "withdraw_method:nogod" || data === "withdraw_method:binance") {
      const method = data === "withdraw_method:nogod" ? "nogod" : "binance";
      const prompt =
        method === "nogod"
          ? "📱 Please enter your *Nogod* number:"
          : "💱 Please enter your *Binance USDT BEP20* wallet address:";
      setState(userId, { withdrawMethod: method, withdrawStep: "awaiting_account" });
      await safeSend(bot, chatId, prompt, { parse_mode: "Markdown" });
      return;
    }

    // ── Withdraw: cancel ──────────────────────────────────────────────────────
    if (data === "withdraw_cancel") {
      clearWithdrawState(userId);
      await safeSend(bot, chatId, "❌ Withdrawal cancelled.", {
        reply_markup: mainMenuKeyboard(),
      });
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
        setState(userId, { activeOrderId: order.id, selectedCountry: country });

        await bot.editMessageText(
          `✅ *Number Acquired!*\n\n` +
            `📱 Number: \`${order.phone}\`\n` +
            `🌍 Country: ${formatCountry(country)}\n` +
            `📲 Service: ${serviceLabel(service)}\n` +
            `💵 Price: $${order.price.toFixed(2)}\n` +
            `🆔 Order ID: ${order.id}\n\n` +
            `⏳ Waiting for SMS… Forward any code you receive here.`,
          {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: "Markdown",
            reply_markup: numberAcquiredKeyboard(order.id),
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

    // ── Others service sub-menu ───────────────────────────────────────────────
    if (data === "service_category:others") {
      await bot.editMessageText("🌐 *Select a service:*", {
        chat_id: chatId,
        message_id: query.message.message_id,
        parse_mode: "Markdown",
        reply_markup: othersMenuKeyboard(),
      });
      return;
    }

    // ── Change Number (same country, same service) ────────────────────────────
    if (data === "change_number") {
      const st = getState(userId);
      if (!st.selectedService || !st.selectedCountry) {
        await safeSend(bot, chatId, "⚠️ Session expired. Please start over.", {
          reply_markup: mainMenuKeyboard(),
        });
        return;
      }
      try {
        await bot.editMessageText(
          `⏳ Getting a new number in *${formatCountry(st.selectedCountry)}*…`,
          { chat_id: chatId, message_id: query.message.message_id, parse_mode: "Markdown" },
        );
        // Cancel previous order silently
        if (st.activeOrderId) {
          try { await cancelOrder(st.activeOrderId); } catch { /* ignore */ }
        }
        const order = await buyNumber(st.selectedCountry, st.selectedService);
        setState(userId, { activeOrderId: order.id });
        await bot.editMessageText(
          `✅ *New Number Acquired!*\n\n` +
            `📱 Number: \`${order.phone}\`\n` +
            `🌍 Country: ${formatCountry(st.selectedCountry)}\n` +
            `📲 Service: ${serviceLabel(st.selectedService)}\n` +
            `💵 Price: $${order.price.toFixed(2)}\n` +
            `🆔 Order ID: ${order.id}\n\n` +
            `⏳ Waiting for SMS… Forward any code you receive here.`,
          {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: "Markdown",
            reply_markup: numberAcquiredKeyboard(order.id),
          },
        );
      } catch (err) {
        logger.error({ err }, "Change number failed");
        const msg = isLowBalanceError(err)
          ? "⚠️ *5sim balance too low.* Please recharge and try again."
          : "⚠️ Could not get a new number. Please try again.";
        await bot.editMessageText(msg, {
          chat_id: chatId,
          message_id: query.message.message_id,
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: [[{ text: "⬅️ Back", callback_data: "back_to_services" }]] },
        });
      }
      return;
    }

    // ── Change Country (same service, re-fetch country list) ──────────────────
    if (data === "back_to_countries") {
      const st = getState(userId);
      if (!st.selectedService) {
        await safeSend(bot, chatId, "⚠️ Session expired. Please start over.", {
          reply_markup: mainMenuKeyboard(),
        });
        return;
      }
      try {
        await bot.editMessageText("🔍 Fetching available countries…", {
          chat_id: chatId,
          message_id: query.message.message_id,
        });
        const countries = await getAvailableCountries(st.selectedService);
        await bot.editMessageText(
          `🌍 *Select a country for ${serviceLabel(st.selectedService)}:*`,
          {
            chat_id: chatId,
            message_id: query.message.message_id,
            parse_mode: "Markdown",
            reply_markup: countryKeyboard(countries),
          },
        );
      } catch (err) {
        logger.error({ err }, "back_to_countries failed");
        await bot.editMessageText("⚠️ Could not fetch countries. Please try again.", {
          chat_id: chatId,
          message_id: query.message.message_id,
          reply_markup: { inline_keyboard: [[{ text: "⬅️ Back", callback_data: "back_to_services" }]] },
        });
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
