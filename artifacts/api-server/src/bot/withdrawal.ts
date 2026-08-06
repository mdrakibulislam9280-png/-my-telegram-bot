import { db, userWalletsTable, withdrawalsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { getOrCreateWallet } from "./wallet";

export const WITHDRAWAL_FEE_BDT = 5;
export const WITHDRAWAL_MIN_BDT = 25;

export type WithdrawResult =
  | { ok: true }
  | { ok: false; reason: "below_minimum" | "insufficient_balance" };

/**
 * Validates and processes a withdrawal request.
 * Deducts (amount + fee) from balance, records the withdrawal, updates total_withdrawn.
 */
export async function processWithdrawal(
  telegramId: number,
  method: "nogod" | "binance",
  account: string,
  amount: number,
): Promise<WithdrawResult> {
  if (amount < WITHDRAWAL_MIN_BDT) {
    return { ok: false, reason: "below_minimum" };
  }

  const total = amount + WITHDRAWAL_FEE_BDT;
  const wallet = await getOrCreateWallet(telegramId);
  const currentBalance = parseFloat(wallet.balanceBdt);

  if (currentBalance < total) {
    return { ok: false, reason: "insufficient_balance" };
  }

  const idStr = String(telegramId);
  const amountStr = amount.toFixed(2);

  await db.transaction(async (tx) => {
    await tx.insert(withdrawalsTable).values({
      telegramId: idStr,
      method,
      account,
      amountBdt: amountStr,
      feeBdt: String(WITHDRAWAL_FEE_BDT),
      status: "completed",
    });

    await tx
      .update(userWalletsTable)
      .set({
        balanceBdt: sql`${userWalletsTable.balanceBdt} - ${total.toFixed(2)}::numeric`,
        totalWithdrawnBdt: sql`${userWalletsTable.totalWithdrawnBdt} + ${amountStr}::numeric`,
      })
      .where(eq(userWalletsTable.telegramId, idStr));
  });

  return { ok: true };
}
