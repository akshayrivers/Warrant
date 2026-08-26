import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  asAgentId,
  asMerchantId,
  asTransactionId,
  asWarrantId,
  money,
} from "../../domain/types.js";
import { signWarrant } from "../../warrant/sign.js";
import { InMemorySpendingRepository } from "./spending.repository.js";
import { InMemoryTransactionRepository } from "./transaction.repository.js";
import { InMemoryWarrantRepository } from "./warrant.repository.js";

const SECRET = "secret-key-123";

describe("Repositories (In-Memory)", () => {
  test("WarrantRepository saves and retrieves signed warrant", async () => {
    const repo = new InMemoryWarrantRepository();
    const warrant = signWarrant(
      {
        warrantId: asWarrantId("w_test_1"),
        principal: "alice",
        agentId: asAgentId("agent_1"),
        allowedMerchants: [asMerchantId("freshmart")],
        allowedCategories: ["groceries"],
        perTransactionLimit: money(1000),
        dailyLimit: money(5000),
        issuedAt: "2026-08-25T00:00:00Z",
        expiresAt: "2026-08-30T00:00:00Z",
      },
      SECRET,
    );

    await repo.save(warrant);
    const retrieved = await repo.getById(asWarrantId("w_test_1"));
    assert.deepEqual(retrieved, warrant);

    const list = await repo.list();
    assert.equal(list.length, 1);
  });

  test("SpendingRepository tracks daily spending and resets on new day", async () => {
    const repo = new InMemorySpendingRepository();
    const warrantId = asWarrantId("w_test_2");
    const day1 = new Date("2026-08-25T10:00:00Z");
    const day2 = new Date("2026-08-26T10:00:00Z");

    const state1 = await repo.getSpendingState(warrantId, day1);
    assert.equal(state1.spentTodayMinorUnits, 0);
    assert.equal(state1.processedTransactionIds.size, 0);

    // Record txn 1 on day 1
    await repo.recordAllowedTransaction(warrantId, asTransactionId("tx_1"), 1500, day1);
    const state2 = await repo.getSpendingState(warrantId, day1);
    assert.equal(state2.spentTodayMinorUnits, 1500);
    assert.ok(state2.processedTransactionIds.has(asTransactionId("tx_1")));

    // Record txn 2 on day 1
    await repo.recordAllowedTransaction(warrantId, asTransactionId("tx_2"), 2000, day1);
    const state3 = await repo.getSpendingState(warrantId, day1);
    assert.equal(state3.spentTodayMinorUnits, 3500);
    assert.equal(state3.processedTransactionIds.size, 2);

    // Check spending state on day 2 (spentToday resets, but processed transactions persist to prevent replay)
    const stateDay2 = await repo.getSpendingState(warrantId, day2);
    assert.equal(stateDay2.spentTodayMinorUnits, 0);
    assert.ok(stateDay2.processedTransactionIds.has(asTransactionId("tx_1")));
    assert.ok(stateDay2.processedTransactionIds.has(asTransactionId("tx_2")));
  });

  test("TransactionRepository saves and retrieves transactions", async () => {
    const repo = new InMemoryTransactionRepository();
    const tx = {
      transactionId: asTransactionId("tx_save_1"),
      warrantId: asWarrantId("w_test_1"),
      agentId: asAgentId("agent_1"),
      merchantId: asMerchantId("freshmart"),
      category: "groceries",
      sku: "milk-2l",
      amountMinorUnits: 1284,
      currency: "INR" as const,
      outcome: "ALLOW" as const,
      reason: "POLICY_SATISFIED",
      paymentId: "pay_123",
      paymentStatus: "SUCCESS",
      requestedAt: "2026-08-25T10:00:00Z",
      processedAt: "2026-08-25T10:00:01Z",
    };

    await repo.save(tx);
    const fetched = await repo.getById(asTransactionId("tx_save_1"));
    assert.deepEqual(fetched, tx);

    const list = await repo.list({ warrantId: asWarrantId("w_test_1") });
    assert.equal(list.length, 1);
  });
});
