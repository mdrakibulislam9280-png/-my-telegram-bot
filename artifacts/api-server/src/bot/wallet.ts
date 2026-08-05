import { db, userWalletsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

/**
 * Fetch a user's wallet row, creating it with defaults if it doesn't exist yet.
 */
export async function getOrCreateWallet(telegramId: number) {
  const id = String(telegramId);

  const existing = await db
    .select()
    .from(userWalletsTable)
    .where(eq(userWalletsTable.telegramId, id))
    .limit(1);

  if (existing.length > 0) return existing[0]!;

  const inserted = await db
    .insert(userWalletsTable)
    .values({ telegramId: id, balanceBdt: "0.00", totalOrders: 0 })
    .returning();

  return inserted[0]!;
}

/**
 * Increment a user's total order count after a successful purchase.
 */
export async function incrementOrderCount(telegramId: number): Promise<void> {
  const id = String(telegramId);
  const wallet = await getOrCreateWallet(telegramId);

  await db
    .update(userWalletsTable)
    .set({ totalOrders: wallet.totalOrders + 1 })
    .where(eq(userWalletsTable.telegramId, id));
}
