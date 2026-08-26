import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { asAgentId, asMerchantId, asTransactionId, asWarrantId } from "../domain/types.js";
import { InMemoryAuditRepository } from "./repository.js";
import { AuditService } from "./service.js";

describe("Audit Service & Cryptographic Hash Chain", () => {
  test("creates a sequential tamper-evident hash chain", async () => {
    const repo = new InMemoryAuditRepository();
    const service = new AuditService(repo);

    const event1 = await service.logWarrantIssued({
      warrantId: asWarrantId("w_01"),
      principal: "user_alice",
      agentId: asAgentId("agent_groceries"),
      perTransactionLimitMinorUnits: 200000,
      dailyLimitMinorUnits: 500000,
      expiresAt: "2026-08-30T00:00:00Z",
    });

    assert.equal(event1.previousEventHash, null);
    assert.ok(event1.eventHash.length === 64);

    const event2 = await service.logProposalReceived({
      transactionId: asTransactionId("tx_01"),
      warrantId: asWarrantId("w_01"),
      agentId: asAgentId("agent_groceries"),
      merchantId: asMerchantId("freshmart"),
      sku: "milk-2l",
      category: "groceries",
      amountMinorUnits: 1284,
    });

    assert.equal(event2.previousEventHash, event1.eventHash);
    assert.ok(event2.eventHash.length === 64);

    const event3 = await service.logPolicyEvaluated({
      transactionId: asTransactionId("tx_01"),
      warrantId: asWarrantId("w_01"),
      outcome: "ALLOW",
      reason: "POLICY_SATISFIED",
      spentTodayMinorUnits: 0,
      dailyLimitMinorUnits: 500000,
      perTransactionLimitMinorUnits: 200000,
    });

    assert.equal(event3.previousEventHash, event2.eventHash);

    const integrity = await service.verifyIntegrity();
    assert.equal(integrity.valid, true);
    assert.equal(integrity.totalEvents, 3);
  });

  test("detects tampering when an event is modified in repository", async () => {
    const repo = new InMemoryAuditRepository();
    const service = new AuditService(repo);

    await service.logWarrantIssued({
      warrantId: asWarrantId("w_01"),
      principal: "user_alice",
      agentId: asAgentId("agent_groceries"),
      perTransactionLimitMinorUnits: 200000,
      dailyLimitMinorUnits: 500000,
      expiresAt: "2026-08-30T00:00:00Z",
    });

    await service.logPolicyEvaluated({
      transactionId: asTransactionId("tx_01"),
      warrantId: asWarrantId("w_01"),
      outcome: "BLOCK",
      reason: "TRANSACTION_LIMIT_EXCEEDED",
      spentTodayMinorUnits: 0,
      dailyLimitMinorUnits: 500000,
      perTransactionLimitMinorUnits: 200000,
    });

    // Tamper with event 2 in the repo
    const events = (repo as unknown as { events: Array<Record<string, unknown>> }).events;
    // An attacker tries to change BLOCK to ALLOW in the audit log
    events[1] = {
      ...events[1]!,
      details: {
        ...(events[1]!.details as Record<string, unknown>),
        outcome: "ALLOW",
      },
    };

    const integrity = await service.verifyIntegrity();
    assert.equal(integrity.valid, false);
    assert.ok(integrity.reason?.includes("Hash mismatch"));
  });

  test("queries audit events with filters", async () => {
    const repo = new InMemoryAuditRepository();
    const service = new AuditService(repo);

    await service.logWarrantIssued({
      warrantId: asWarrantId("w_01"),
      principal: "alice",
      agentId: asAgentId("agent_1"),
      perTransactionLimitMinorUnits: 1000,
      dailyLimitMinorUnits: 5000,
      expiresAt: "2026-08-30T00:00:00Z",
    });

    await service.logWarrantIssued({
      warrantId: asWarrantId("w_02"),
      principal: "bob",
      agentId: asAgentId("agent_2"),
      perTransactionLimitMinorUnits: 2000,
      dailyLimitMinorUnits: 10000,
      expiresAt: "2026-08-30T00:00:00Z",
    });

    const aliceEvents = await service.query({ warrantId: asWarrantId("w_01") });
    assert.equal(aliceEvents.length, 1);
    assert.equal(aliceEvents[0]?.warrantId, asWarrantId("w_01"));
  });
});
