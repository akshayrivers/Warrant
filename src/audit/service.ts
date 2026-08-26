import { randomUUID } from "node:crypto";
import type { AgentId, DecisionReason, MerchantId, TransactionId, WarrantId } from "../domain/types.js";
import type { ProposalValidationReason } from "../catalog/validate.js";
import {
  type AuditEvent,
  type AuditEventType,
  computeEventHash,
  type PaymentEventPayload,
  type PolicyEvaluatedEventPayload,
  type ProposalReceivedEventPayload,
  type ProposalValidationEventPayload,
  type WarrantIssuedEventPayload,
} from "./events.js";
import type { AuditQueryFilter, AuditRepository, IntegrityCheckResult } from "./repository.js";

export class AuditService {
  constructor(private readonly repository: AuditRepository) {}

  /**
   * Appends an event to the audit trail, maintaining cryptographic hash chain continuity.
   */
  async logEvent(params: {
    eventType: AuditEventType;
    warrantId?: WarrantId | undefined;
    transactionId?: TransactionId | undefined;
    agentId?: AgentId | undefined;
    merchantId?: MerchantId | undefined;
    details: Record<string, unknown>;
    timestamp?: string | undefined;
  }): Promise<AuditEvent> {
    const latest = await this.repository.getLatestEvent();
    const previousEventHash = latest?.eventHash ?? null;

    const id = randomUUID();
    const timestamp = params.timestamp ?? new Date().toISOString();

    const eventWithoutHash = {
      id,
      timestamp,
      eventType: params.eventType,
      warrantId: params.warrantId,
      transactionId: params.transactionId,
      agentId: params.agentId,
      merchantId: params.merchantId,
      details: params.details,
      previousEventHash,
    };

    const eventHash = computeEventHash(eventWithoutHash);

    const fullEvent: AuditEvent = {
      ...eventWithoutHash,
      eventHash,
    };

    return this.repository.append(fullEvent);
  }

  async logWarrantIssued(payload: WarrantIssuedEventPayload): Promise<AuditEvent> {
    return this.logEvent({
      eventType: "WARRANT_ISSUED",
      warrantId: payload.warrantId,
      agentId: payload.agentId,
      details: {
        principal: payload.principal,
        perTransactionLimitMinorUnits: payload.perTransactionLimitMinorUnits,
        dailyLimitMinorUnits: payload.dailyLimitMinorUnits,
        expiresAt: payload.expiresAt,
      },
    });
  }

  async logProposalReceived(payload: ProposalReceivedEventPayload): Promise<AuditEvent> {
    return this.logEvent({
      eventType: "PROPOSAL_RECEIVED",
      warrantId: payload.warrantId,
      transactionId: payload.transactionId,
      agentId: payload.agentId,
      merchantId: payload.merchantId,
      details: {
        sku: payload.sku,
        category: payload.category,
        amountMinorUnits: payload.amountMinorUnits,
      },
    });
  }

  async logProposalValidated(payload: ProposalValidationEventPayload): Promise<AuditEvent> {
    const eventType: AuditEventType = payload.valid ? "PROPOSAL_VALIDATED" : "PROPOSAL_REJECTED";
    return this.logEvent({
      eventType,
      transactionId: payload.transactionId,
      details: {
        valid: payload.valid,
        reason: payload.reason,
        sku: payload.sku,
        priceMinorUnits: payload.priceMinorUnits,
      },
    });
  }

  async logPolicyEvaluated(payload: PolicyEvaluatedEventPayload): Promise<AuditEvent> {
    return this.logEvent({
      eventType: "POLICY_EVALUATED",
      warrantId: payload.warrantId,
      transactionId: payload.transactionId,
      details: {
        outcome: payload.outcome,
        reason: payload.reason,
        spentTodayMinorUnits: payload.spentTodayMinorUnits,
        dailyLimitMinorUnits: payload.dailyLimitMinorUnits,
        perTransactionLimitMinorUnits: payload.perTransactionLimitMinorUnits,
      },
    });
  }

  async logPaymentInitiated(payload: {
    transactionId: TransactionId;
    warrantId: WarrantId;
    amountMinorUnits: number;
    merchantId: MerchantId;
  }): Promise<AuditEvent> {
    return this.logEvent({
      eventType: "PAYMENT_INITIATED",
      transactionId: payload.transactionId,
      warrantId: payload.warrantId,
      merchantId: payload.merchantId,
      details: {
        amountMinorUnits: payload.amountMinorUnits,
      },
    });
  }

  async logPaymentResult(payload: PaymentEventPayload): Promise<AuditEvent> {
    const eventType: AuditEventType = payload.status === "SUCCESS" ? "PAYMENT_COMPLETED" : "PAYMENT_FAILED";
    return this.logEvent({
      eventType,
      transactionId: payload.transactionId,
      details: {
        status: payload.status,
        paymentId: payload.paymentId,
        orderId: payload.orderId,
        amountMinorUnits: payload.amountMinorUnits,
        error: payload.error,
      },
    });
  }

  async query(filter?: AuditQueryFilter): Promise<readonly AuditEvent[]> {
    return this.repository.query(filter);
  }

  async verifyIntegrity(): Promise<IntegrityCheckResult> {
    return this.repository.verifyIntegrity();
  }
}
