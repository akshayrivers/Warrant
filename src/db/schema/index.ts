import { bigint, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const warrantsTable = pgTable("warrants", {
  warrantId: text("warrant_id").primaryKey(),
  principal: text("principal").notNull(),
  agentId: text("agent_id").notNull(),
  allowedMerchants: jsonb("allowed_merchants").$type<string[]>().notNull(),
  allowedCategories: jsonb("allowed_categories").$type<string[]>().notNull(),
  perTransactionLimitMinorUnits: bigint("per_transaction_limit_minor_units", { mode: "number" }).notNull(),
  dailyLimitMinorUnits: bigint("daily_limit_minor_units", { mode: "number" }).notNull(),
  currency: text("currency").notNull().default("INR"),
  issuedAt: timestamp("issued_at", { withTimezone: true, mode: "string" }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" }).notNull(),
  signature: text("signature").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
});

export const spendingStateTable = pgTable("spending_state", {
  warrantId: text("warrant_id").primaryKey().references(() => warrantsTable.warrantId),
  spentTodayMinorUnits: bigint("spent_today_minor_units", { mode: "number" }).notNull().default(0),
  lastResetDate: text("last_reset_date").notNull(), // YYYY-MM-DD
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
});

export const transactionsTable = pgTable("transactions", {
  transactionId: text("transaction_id").primaryKey(),
  warrantId: text("warrant_id").notNull().references(() => warrantsTable.warrantId),
  agentId: text("agent_id").notNull(),
  merchantId: text("merchant_id").notNull(),
  category: text("category").notNull(),
  sku: text("sku").notNull(),
  amountMinorUnits: bigint("amount_minor_units", { mode: "number" }).notNull(),
  currency: text("currency").notNull().default("INR"),
  outcome: text("outcome").notNull(), // ALLOW | BLOCK
  reason: text("reason").notNull(),
  paymentId: text("payment_id"),
  paymentStatus: text("payment_status"),
  requestedAt: timestamp("requested_at", { withTimezone: true, mode: "string" }).notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
});

export const auditEventsTable = pgTable("audit_events", {
  id: text("id").primaryKey(),
  timestamp: timestamp("timestamp", { withTimezone: true, mode: "string" }).notNull(),
  eventType: text("event_type").notNull(),
  warrantId: text("warrant_id"),
  transactionId: text("transaction_id"),
  agentId: text("agent_id"),
  merchantId: text("merchant_id"),
  details: jsonb("details").$type<Record<string, unknown>>().notNull(),
  previousEventHash: text("previous_event_hash"),
  eventHash: text("event_hash").notNull(),
});
