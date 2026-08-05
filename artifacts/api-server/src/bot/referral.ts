import { db, userWalletsTable, referralsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { getOrCreateWallet } from "./wallet";

const REFERRAL_REWARD_BDT = "0.10";

/** Returns the referral code for a given Telegram user ID. */
export function getReferralCode(telegramId: number): string {
  return `ref_${telegramId}`;
}

/** Parses a referral code back to a Telegram user ID, or null if invalid. */
export function parseReferralCode(code: string): number | null {
  const match = /^ref_(\d+)$/.exec(code);
  if (!match || !match[1]) return null;
  const id = parseInt(match[1], 10);
  return isNaN(id) ? null : id;
}

export type ReferralResult =
  | "credited"
  | "already_referred"
  | "invalid_code"
  | "self_referral";

/**
 * Processes a referral when a new user joins via a referral link.
 * Credits the referrer 0.10 BDT if the referral is valid and hasn't been counted before.
 */
export async function processReferral(
  referredTelegramId: number,
  referralCode: string,
): Promise<ReferralResult> {
  const referrerId = parseReferralCode(referralCode);
  if (referrerId === null) return "invalid_code";
  if (referrerId === referredTelegramId) return "self_referral";

  const referredIdStr = String(referredTelegramId);
  const referrerIdStr = String(referrerId);

  // Check if this user was already referred by someone
  const existing = await db
    .select()
    .from(referralsTable)
    .where(eq(referralsTable.referredTelegramId, referredIdStr))
    .limit(1);

  if (existing.length > 0) return "already_referred";

  // Ensure referrer has a wallet before crediting them
  await getOrCreateWallet(referrerId);

  // Record referral and credit referrer atomically
  await db.transaction(async (tx) => {
    await tx.insert(referralsTable).values({
      referrerTelegramId: referrerIdStr,
      referredTelegramId: referredIdStr,
    });

    await tx
      .update(userWalletsTable)
      .set({
        referralCount: sql`${userWalletsTable.referralCount} + 1`,
        referralEarningsBdt: sql`${userWalletsTable.referralEarningsBdt} + ${REFERRAL_REWARD_BDT}::numeric`,
      })
      .where(eq(userWalletsTable.telegramId, referrerIdStr));
  });

  return "credited";
}

/** Fetches referral stats for a user. */
export async function getReferralStats(telegramId: number): Promise<{
  referralCount: number;
  referralEarningsBdt: string;
}> {
  const wallet = await getOrCreateWallet(telegramId);
  return {
    referralCount: wallet.referralCount,
    referralEarningsBdt: wallet.referralEarningsBdt,
  };
}
