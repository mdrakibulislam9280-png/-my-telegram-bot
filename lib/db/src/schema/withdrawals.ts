import { pgTable, serial, text, numeric, timestamp } from "drizzle-orm/pg-core";

export const withdrawalsTable = pgTable("withdrawals", {
  id: serial("id").primaryKey(),
  telegramId: text("telegram_id").notNull(),
  method: text("method").notNull(),         // "nogod" | "binance"
  account: text("account").notNull(),        // Nogod number or Binance address
  amountBdt: numeric("amount_bdt", { precision: 12, scale: 2 }).notNull(),
  feeBdt: numeric("fee_bdt", { precision: 12, scale: 2 }).notNull().default("5.00"),
  status: text("status").notNull().default("completed"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Withdrawal = typeof withdrawalsTable.$inferSelect;
