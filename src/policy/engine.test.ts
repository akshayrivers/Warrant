import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  asAgentId,
  asMerchantId,
  asTransactionId,
  asWarrantId,
  money,
  type SpendingState,
  type TransactionRequest,
  type WarrantPayload,
} from "../domain/types.js";
import { signWarrant } from "../mandate/sign.js";
import { evaluate } from "./engine.js";

const SECRET = "test-only-secret-do-not-use-in-prod";
const NOW = new Date("2026-08-25T10:00:00Z");

function basePayload(overrides: Partial<WarrantPayload> = {}): WarrantPayload {
  return {
    warrantId: asWarrantId("warrant_001"),
    principal: "akshay",
    agentId: asAgentId("agent_grocery"),
    allowedMerchants: [asMerchantId("freshmart")],
    allowedCategories: ["groceries"],
    perTransactionLimit: money(2000),
    dailyLimit: money(5000),
    issuedAt: new Date("2026-08-25T00:00:00Z").toISOString(),
    expiresAt: new Date("2026-08-31T23:59:59Z").toISOString(),
    ...overrides,
  };
}

function emptySpending(): SpendingState {
  return { spentTodayMinorUnits: 0, processedTransactionIds: new Set() };
}

function baseRequest(overrides: Partial<TransactionRequest> = {}): TransactionRequest {
  return {
    transactionId: asTransactionId("txn_001"),
    warrantId: asWarrantId("warrant_001"),
    agentId: asAgentId("agent_grocery"),
    merchantId: asMerchantId("freshmart"),
    category: "groceries",
    sku: "milk-2l",
    amount: money(1284),
    requestedAt: NOW.toISOString(),
    ...overrides,
  };
}

describe("Warrant policy engine", () => {
  test("allows a legitimate transaction within every limit", () => {
    const warrant = signWarrant(basePayload(), SECRET);
    const decision = evaluate({ request: baseRequest(), warrant, spending: emptySpending(), secret: SECRET, now: NOW });
    assert.equal(decision.outcome, "ALLOW");
    assert.equal(decision.reason, "POLICY_SATISFIED");
  });

  test("attack: per-transaction limit bypass is blocked", () => {
    const warrant = signWarrant(basePayload(), SECRET);
    const decision = evaluate({
      request: baseRequest({ amount: money(2850) }), // limit is 2000
      warrant,
      spending: emptySpending(),
      secret: SECRET,
      now: NOW,
    });
    assert.equal(decision.outcome, "BLOCK");
    assert.equal(decision.reason, "TRANSACTION_LIMIT_EXCEEDED");
  });

  test("attack: a tampered warrant fails signature verification", () => {
    const warrant = signWarrant(basePayload(), SECRET);
    const tampered = {
      ...warrant,
      payload: { ...warrant.payload, perTransactionLimit: money(999999) },
    };
    const decision = evaluate({
      request: baseRequest({ amount: money(50000) }),
      warrant: tampered,
      spending: emptySpending(),
      secret: SECRET,
      now: NOW,
    });
    assert.equal(decision.outcome, "BLOCK");
    assert.equal(decision.reason, "INVALID_SIGNATURE");
  });

  test("attack: a replayed transaction id is blocked, not double-charged", () => {
    const warrant = signWarrant(basePayload(), SECRET);
    const request = baseRequest();
    const decision = evaluate({
      request,
      warrant,
      spending: { spentTodayMinorUnits: 0, processedTransactionIds: new Set([request.transactionId]) },
      secret: SECRET,
      now: NOW,
    });
    assert.equal(decision.outcome, "BLOCK");
    assert.equal(decision.reason, "DUPLICATE_TRANSACTION");
  });

  test("an expired warrant is blocked", () => {
    const warrant = signWarrant(basePayload(), SECRET);
    const decision = evaluate({
      request: baseRequest(),
      warrant,
      spending: emptySpending(),
      secret: SECRET,
      now: new Date("2026-09-01T00:00:00Z"),
    });
    assert.equal(decision.outcome, "BLOCK");
    assert.equal(decision.reason, "WARRANT_EXPIRED");
  });

  test("a merchant off the allow-list is blocked", () => {
    const warrant = signWarrant(basePayload(), SECRET);
    const decision = evaluate({
      request: baseRequest({ merchantId: asMerchantId("randomshop") }),
      warrant,
      spending: emptySpending(),
      secret: SECRET,
      now: NOW,
    });
    assert.equal(decision.outcome, "BLOCK");
    assert.equal(decision.reason, "MERCHANT_NOT_ALLOWED");
  });

  test("crossing the cumulative daily limit is blocked even under the per-transaction cap", () => {
    const warrant = signWarrant(basePayload(), SECRET);
    const decision = evaluate({
      request: baseRequest({ transactionId: asTransactionId("txn_002"), amount: money(1900) }),
      warrant,
      spending: { spentTodayMinorUnits: money(3200).minorUnits, processedTransactionIds: new Set() },
      secret: SECRET,
      now: NOW,
    });
    assert.equal(decision.outcome, "BLOCK");
    assert.equal(decision.reason, "DAILY_LIMIT_EXCEEDED");
  });

  test("determinism: identical inputs always produce an identical decision", () => {
    const warrant = signWarrant(basePayload(), SECRET);
    const request = baseRequest();
    const spending = emptySpending();
    const first = evaluate({ request, warrant, spending, secret: SECRET, now: NOW });
    const second = evaluate({ request, warrant, spending, secret: SECRET, now: NOW });
    assert.deepEqual(first, second);
  });
});
