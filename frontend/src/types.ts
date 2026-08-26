export type CurrencyCode = "INR";

export interface Money {
  readonly minorUnits: number;
  readonly currency: CurrencyCode;
}

export interface WarrantPayload {
  readonly warrantId: string;
  readonly principal: string;
  readonly agentId: string;
  readonly allowedMerchants: readonly string[];
  readonly allowedCategories: readonly string[];
  readonly perTransactionLimit: Money;
  readonly dailyLimit: Money;
  readonly issuedAt: string;
  readonly expiresAt: string;
}

export interface SignedWarrant {
  readonly payload: WarrantPayload;
  readonly signature: string;
}

export interface WarrantWithSpending {
  readonly warrant: SignedWarrant;
  readonly spending: {
    readonly spentTodayMinorUnits: number;
    readonly remainingDailyMinorUnits: number;
    readonly processedTransactionsCount: number;
  };
}

export interface Product {
  readonly sku: string;
  readonly merchantId: string;
  readonly name: string;
  readonly description: string;
  readonly category: string;
  readonly priceMinorUnits: number;
  readonly available: boolean;
}

export interface Merchant {
  readonly merchantId: string;
  readonly name: string;
  readonly status: "AVAILABLE" | "OFFLINE";
}

export interface Catalog {
  readonly merchant: Merchant;
  readonly products: readonly Product[];
}

export interface TransactionProposal {
  readonly merchantId: string;
  readonly sku: string;
  readonly category: string;
  readonly amountMinorUnits: number;
}

export type ProposalValidationReason =
  | "MERCHANT_NOT_FOUND"
  | "PRODUCT_NOT_FOUND"
  | "PRODUCT_UNAVAILABLE"
  | "MERCHANT_MISMATCH"
  | "CATEGORY_MISMATCH"
  | "PRICE_MISMATCH"
  | "INVALID_AMOUNT";

export type ProposalValidation =
  | {
      readonly valid: true;
      readonly product: Product;
    }
  | {
      readonly valid: false;
      readonly reason: ProposalValidationReason;
    };

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
  readonly transactionId: string;
  readonly warrantId: string;
  readonly evaluatedAt: string;
}

export interface PaymentResult {
  readonly status: "SUCCESS" | "FAILED";
  readonly paymentId: string;
  readonly orderId: string;
  readonly amount: Money;
  readonly timestamp: string;
  readonly error?: string;
  readonly testMode: boolean;
}

export interface ExecuteTransactionResponse {
  readonly success: boolean;
  readonly stage: "PROPOSAL_VALIDATION" | "POLICY_EVALUATION" | "COMPLETED";
  readonly proposalValidation: ProposalValidation;
  readonly decision: PolicyDecision;
  readonly payment: PaymentResult | null;
}

export interface TransactionRecord {
  readonly transactionId: string;
  readonly warrantId: string;
  readonly agentId: string;
  readonly merchantId: string;
  readonly category: string;
  readonly sku: string;
  readonly amountMinorUnits: number;
  readonly currency: CurrencyCode;
  readonly outcome: "ALLOW" | "BLOCK";
  readonly reason: string;
  readonly paymentId?: string;
  readonly paymentStatus?: string;
  readonly requestedAt: string;
  readonly processedAt: string;
}

export interface AuditEvent {
  readonly id: string;
  readonly timestamp: string;
  readonly eventType: string;
  readonly warrantId?: string;
  readonly transactionId?: string;
  readonly agentId?: string;
  readonly merchantId?: string;
  readonly details: Record<string, unknown>;
  readonly previousEventHash: string | null;
  readonly eventHash: string;
}

export interface IntegrityCheckResult {
  readonly valid: boolean;
  readonly totalEvents: number;
  readonly compromisedEventId?: string;
  readonly reason?: string;
}

export interface AgentRunResult {
  readonly responseText: string;
  readonly proposal?: {
    readonly request: {
      readonly transactionId: string;
      readonly warrantId: string;
      readonly agentId: string;
      readonly merchantId: string;
      readonly category: string;
      readonly sku: string;
      readonly amount: Money;
      readonly requestedAt: string;
    };
    readonly product: Product;
  };
  readonly toolCalls: Array<{
    readonly name: string;
    readonly args: Record<string, unknown>;
    readonly result: unknown;
  }>;
}
