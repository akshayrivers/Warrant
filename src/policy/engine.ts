import type {
  DecisionReason,
  PolicyDecision,
  SignedWarrant,
  SpendingState,
  TransactionRequest,
} from "../domain/types.js";
import { verifyWarrant } from "../mandate/sign.js";

export interface EvaluateInput {
  readonly request: TransactionRequest;
  readonly warrant: SignedWarrant;
  readonly spending: SpendingState;
  readonly secret: string;
  readonly now?: Date;
}

function decide(
  outcome: PolicyDecision["outcome"],
  reason: DecisionReason,
  request: TransactionRequest,
  now: Date,
): PolicyDecision {
  return {
    outcome,
    reason,
    transactionId: request.transactionId,
    warrantId: request.warrantId,
    evaluatedAt: now.toISOString(),
  };
}

/**
 * Pure, deterministic authorization check.
 *
 * Deliberately knows nothing about HTTP, a database, an LLM, or the
 * Razorpay SDK — it only ever sees plain data and returns a plain
 * decision. Same inputs, same decision, every time. This function is
 * the actual thesis of the project: the API, the agent, the dashboard,
 * and the Razorpay call all exist to feed it or act on its answer, not
 * the other way around.
 *
 * Catalog/SKU/price validation deliberately happens *before* this is
 * called. "Is this a real product at the price the agent claims" is a
 * check on untrusted agent output; "is this agent allowed to spend this
 * much, here, right now" is authorization. Different trust boundaries,
 * kept in different functions on purpose.
 */
export function evaluate({ request, warrant, spending, secret, now = new Date() }: EvaluateInput): PolicyDecision {
  if (!verifyWarrant(warrant, secret)) {
    return decide("BLOCK", "INVALID_SIGNATURE", request, now);
  }

  const { payload } = warrant;

  if (now.getTime() > Date.parse(payload.expiresAt)) {
    return decide("BLOCK", "WARRANT_EXPIRED", request, now);
  }

  if (request.agentId !== payload.agentId) {
    return decide("BLOCK", "AGENT_MISMATCH", request, now);
  }

  if (!payload.allowedMerchants.includes(request.merchantId)) {
    return decide("BLOCK", "MERCHANT_NOT_ALLOWED", request, now);
  }

  if (!payload.allowedCategories.includes(request.category)) {
    return decide("BLOCK", "CATEGORY_NOT_ALLOWED", request, now);
  }

  if (request.amount.currency !== payload.perTransactionLimit.currency) {
    return decide("BLOCK", "CURRENCY_MISMATCH", request, now);
  }

  if (request.amount.minorUnits > payload.perTransactionLimit.minorUnits) {
    return decide("BLOCK", "TRANSACTION_LIMIT_EXCEEDED", request, now);
  }

  const projected = spending.spentTodayMinorUnits + request.amount.minorUnits;
  if (projected > payload.dailyLimit.minorUnits) {
    return decide("BLOCK", "DAILY_LIMIT_EXCEEDED", request, now);
  }

  if (spending.processedTransactionIds.has(request.transactionId)) {
    return decide("BLOCK", "DUPLICATE_TRANSACTION", request, now);
  }

  return decide("ALLOW", "POLICY_SATISFIED", request, now);
}
