// Branded (nominal) types — prevents accidentally passing a MerchantId
// where a WarrantId is expected, even though both are strings at runtime.
type Brand<T, B extends string> = T & { readonly __brand: B };

export type WarrantId = Brand<string, "WarrantId">;
export type AgentId = Brand<string, "AgentId">;
export type MerchantId = Brand<string, "MerchantId">;
export type TransactionId = Brand<string, "TransactionId">;

export const asWarrantId = (s: string): WarrantId => s as WarrantId;
export const asAgentId = (s: string): AgentId => s as AgentId;
export const asMerchantId = (s: string): MerchantId => s as MerchantId;
export const asTransactionId = (s: string): TransactionId => s as TransactionId;

export type CurrencyCode = "INR";

// Never floats for money. Razorpay itself expects amounts as integers in
// the smallest currency subunit (paise for INR) — so this isn't just
// internal hygiene, it's the shape the real API requires at the boundary.
export interface Money {
  readonly minorUnits: number;
  readonly currency: CurrencyCode;
}

export function money(rupees: number, currency: CurrencyCode = "INR"): Money {
  if (!Number.isFinite(rupees) || rupees < 0) {
    throw new Error(`invalid amount: ${rupees}`);
  }
  return { minorUnits: Math.round(rupees * 100), currency };
}

export interface WarrantPayload {
  readonly warrantId: WarrantId;
  readonly principal: string; // who granted this authority
  readonly agentId: AgentId; // who may act under it
  readonly allowedMerchants: readonly MerchantId[];
  readonly allowedCategories: readonly string[];
  readonly perTransactionLimit: Money;
  readonly dailyLimit: Money;
  readonly issuedAt: string; // ISO 8601
  readonly expiresAt: string; // ISO 8601
}

export interface SignedWarrant {
  readonly payload: WarrantPayload;
  readonly signature: string; // hex HMAC-SHA256 over the canonical payload
}

export interface TransactionRequest {
  readonly transactionId: TransactionId; // caller-generated, drives replay protection
  readonly warrantId: WarrantId;
  readonly agentId: AgentId;
  readonly merchantId: MerchantId;
  readonly category: string;
  readonly sku: string; // Stock Keeping unit = bar code or qr code used by vendors to track and manage inventory
  readonly amount: Money;
  readonly requestedAt: string;
}

export interface SpendingState {
  readonly spentTodayMinorUnits: number;
  readonly processedTransactionIds: ReadonlySet<TransactionId>;
}

export type DecisionReason =
  | "POLICY_SATISFIED"
  | "INVALID_SIGNATURE"
  | "WARRANT_EXPIRED"
  | "AGENT_MISMATCH"
  | "MERCHANT_NOT_ALLOWED"
  | "CATEGORY_NOT_ALLOWED"
  | "CURRENCY_MISMATCH"
  | "TRANSACTION_LIMIT_EXCEEDED"
  | "DAILY_LIMIT_EXCEEDED"
  | "DUPLICATE_TRANSACTION";

export interface PolicyDecision {
  readonly outcome: "ALLOW" | "BLOCK";
  readonly reason: DecisionReason;
  readonly transactionId: TransactionId;
  readonly warrantId: WarrantId;
  readonly evaluatedAt: string;
}
