import { createHash } from "node:crypto";
import type { AgentId, DecisionReason, MerchantId, TransactionId, WarrantId } from "../domain/types.js";
import type { ProposalValidationReason } from "../catalog/validate.js";

export type AuditEventType =
  | "WARRANT_ISSUED"
  | "PROPOSAL_RECEIVED"
  | "PROPOSAL_VALIDATED"
  | "PROPOSAL_REJECTED"
  | "POLICY_EVALUATED"
  | "PAYMENT_INITIATED"
  | "PAYMENT_COMPLETED"
  | "PAYMENT_FAILED"
  | "TRANSACTION_FINALIZED";

export interface BaseAuditEvent {
  readonly id: string;
  readonly timestamp: string;
  readonly eventType: AuditEventType;
  readonly warrantId?: WarrantId | undefined;
  readonly transactionId?: TransactionId | undefined;
  readonly agentId?: AgentId | undefined;
  readonly merchantId?: MerchantId | undefined;
  readonly details: Record<string, unknown>;
  readonly previousEventHash: string | null;
  readonly eventHash: string;
}

export interface WarrantIssuedEventPayload {
  readonly warrantId: WarrantId;
  readonly principal: string;
  readonly agentId: AgentId;
  readonly perTransactionLimitMinorUnits: number;
  readonly dailyLimitMinorUnits: number;
  readonly expiresAt: string;
}

export interface ProposalReceivedEventPayload {
  readonly transactionId: TransactionId;
  readonly warrantId: WarrantId;
  readonly agentId: AgentId;
  readonly merchantId: MerchantId;
  readonly sku: string;
  readonly category: string;
  readonly amountMinorUnits: number;
}

export interface ProposalValidationEventPayload {
  readonly transactionId: TransactionId;
  readonly valid: boolean;
  readonly reason?: ProposalValidationReason | undefined;
  readonly sku: string;
  readonly priceMinorUnits?: number | undefined;
}

export interface PolicyEvaluatedEventPayload {
  readonly transactionId: TransactionId;
  readonly warrantId: WarrantId;
  readonly outcome: "ALLOW" | "BLOCK";
  readonly reason: DecisionReason;
  readonly spentTodayMinorUnits: number;
  readonly dailyLimitMinorUnits: number;
  readonly perTransactionLimitMinorUnits: number;
}

export interface PaymentEventPayload {
  readonly transactionId: TransactionId;
  readonly paymentId?: string | undefined;
  readonly orderId?: string | undefined;
  readonly amountMinorUnits: number;
  readonly status: "SUCCESS" | "FAILED";
  readonly error?: string | undefined;
}

export type AuditEvent = BaseAuditEvent;

/**
 * Deterministic JSON stringify with sorted keys for hash calculation.
 */
function canonicalStringify(obj: unknown): string {
  if (Array.isArray(obj)) {
    return `[${obj.map(canonicalStringify).join(",")}]`;
  }
  if (obj !== null && typeof obj === "object") {
    const entries = Object.entries(obj as Record<string, unknown>).sort(([a], [b]) =>
      a < b ? -1 : a > b ? 1 : 0,
    );
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalStringify(v)}`).join(",")}}`;
  }
  return JSON.stringify(obj);
}

/**
 * Computes the SHA-256 hash of an audit event, chaining with the previous event's hash.
 */
export function computeEventHash(
  eventWithoutHash: Omit<BaseAuditEvent, "eventHash">,
): string {
  const content = canonicalStringify({
    id: eventWithoutHash.id,
    timestamp: eventWithoutHash.timestamp,
    eventType: eventWithoutHash.eventType,
    warrantId: eventWithoutHash.warrantId ?? null,
    transactionId: eventWithoutHash.transactionId ?? null,
    agentId: eventWithoutHash.agentId ?? null,
    merchantId: eventWithoutHash.merchantId ?? null,
    details: eventWithoutHash.details,
    previousEventHash: eventWithoutHash.previousEventHash,
  });

  return createHash("sha256").update(content).digest("hex");
}
