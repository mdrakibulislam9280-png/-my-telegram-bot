import { pgTable, text, integer, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const userWalletsTable = pgTable("user_wallets", {
  telegramId: text("telegram_id").primaryKey(),
  balanceBdt: numeric("balance_bdt", { precision: 12, scale: 2 })
    .notNull()
    .default("0.00"),
  totalOrders: integer("total_orders").notNull().default(0),
  referralCount: integer("referral_count").notNull().default(0),
  referralEarningsBdt: numeric("referral_earnings_bdt", { precision: 12, scale: 2 })
    .notNull()
    .default("0.00"),
  totalWithdrawnBdt: numeric("total_withdrawn_bdt", { precision: 12, scale: 2 })
    .notNull()
    .default("0.00"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertUserWalletSchema = createInsertSchema(
  userWalletsTable,
).omit({ createdAt: true, updatedAt: true });

export type InsertUserWallet = z.infer<typeof insertUserWalletSchema>;
export type UserWallet = typeof userWalletsTable.$inferSelect;
