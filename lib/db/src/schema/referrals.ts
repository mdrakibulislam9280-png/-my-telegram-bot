import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Tracks each referral relationship.
 * referred_telegram_id is unique — a user can only be referred once.
 */
export const referralsTable = pgTable("referrals", {
  id: serial("id").primaryKey(),
  referrerTelegramId: text("referrer_telegram_id").notNull(),
  referredTelegramId: text("referred_telegram_id").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Referral = typeof referralsTable.$inferSelect;
