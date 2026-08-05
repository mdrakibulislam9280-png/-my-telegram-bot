import TelegramBot from "node-telegram-bot-api";
import { logger } from "../lib/logger";

export const CHANNEL_USERNAME = "@RakibCryptoTech";
export const GROUP_USERNAME = "@Rakibul_Otp_Rcv";
export const CHANNEL_LINK = "https://t.me/RakibCryptoTech";
export const GROUP_LINK = "https://t.me/Rakibul_Otp_Rcv";

const JOINED_STATUSES = new Set(["creator", "administrator", "member", "restricted"]);

async function isMember(
  bot: TelegramBot,
  chat: string,
  userId: number,
): Promise<boolean> {
  try {
    const member = await bot.getChatMember(chat, userId);
    return JOINED_STATUSES.has(member.status);
  } catch (err) {
    // If the bot isn't in the chat yet, don't block users — log and fail open.
    logger.warn({ err, chat, userId }, "Could not check membership (is bot in the chat?)");
    return true;
  }
}

export interface MembershipStatus {
  joined: boolean;
  channelJoined: boolean;
  groupJoined: boolean;
}

/** Checks if a user is a member of both the required channel and group. */
export async function checkMembership(
  bot: TelegramBot,
  userId: number,
): Promise<MembershipStatus> {
  const [channelJoined, groupJoined] = await Promise.all([
    isMember(bot, CHANNEL_USERNAME, userId),
    isMember(bot, GROUP_USERNAME, userId),
  ]);
  return { joined: channelJoined && groupJoined, channelJoined, groupJoined };
}

/** Sends the "please join" prompt with channel/group buttons and a Verify button. */
export async function sendJoinPrompt(
  bot: TelegramBot,
  chatId: number,
  status: MembershipStatus,
): Promise<void> {
  const lines: string[] = [
    "🔒 *Access Restricted*\n",
    "You must join our channel and group to use this bot.\n",
  ];

  if (!status.channelJoined) lines.push("❌ Channel: Not joined");
  else lines.push("✅ Channel: Joined");

  if (!status.groupJoined) lines.push("❌ Group: Not joined");
  else lines.push("✅ Group: Joined");

  lines.push("\nJoin using the buttons below, then press *✅ Verify*.");

  try {
    await bot.sendMessage(chatId, lines.join("\n"), {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "📢 Join Channel", url: CHANNEL_LINK },
            { text: "👥 Join Group", url: GROUP_LINK },
          ],
          [{ text: "✅ Verify", callback_data: "verify_membership" }],
        ],
      },
    });
  } catch (err) {
    logger.error({ err, chatId }, "Failed to send join prompt");
  }
}
