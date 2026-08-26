import type { DecisionReason } from "../domain/types.js";

/**
 * Human-readable descriptions and documentation for each Policy Decision Reason.
 */
export const DECISION_REASON_DESCRIPTIONS: Readonly<Record<DecisionReason, string>> = {
  POLICY_SATISFIED: "Transaction satisfied all warrant constraints and authorization policies.",
  INVALID_SIGNATURE: "Cryptographic signature does not match the warrant payload, indicating tampering or forgery.",
  WARRANT_EXPIRED: "The warrant expiration timestamp has passed.",
  AGENT_MISMATCH: "The requesting agent is not authorized to act under this warrant.",
  MERCHANT_NOT_ALLOWED: "The requested merchant is not in the warrant's approved merchant allow-list.",
  CATEGORY_NOT_ALLOWED: "The product category is not in the warrant's approved category allow-list.",
  CURRENCY_MISMATCH: "The transaction currency does not match the warrant currency.",
  TRANSACTION_LIMIT_EXCEEDED: "The transaction amount exceeds the maximum per-transaction limit specified in the warrant.",
  DAILY_LIMIT_EXCEEDED: "The transaction amount would cause total cumulative spending for the day to exceed the daily limit.",
  DUPLICATE_TRANSACTION: "The transaction ID has already been evaluated or processed (replay protection).",
};

/**
 * Returns a human-friendly explanation for a policy decision reason.
 */
export function getReasonDescription(reason: DecisionReason): string {
  return DECISION_REASON_DESCRIPTIONS[reason] ?? `Unknown policy decision reason: ${reason}`;
}

/**
 * Checks if a reason represents an authorization failure vs a success.
 */
export function isAllowedReason(reason: DecisionReason): boolean {
  return reason === "POLICY_SATISFIED";
}
