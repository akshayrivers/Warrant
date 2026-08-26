import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { buildApp } from "../../server/app.js";
import { createAppContext } from "../../server/context.js";

describe("End-to-End Pipeline Integration", () => {
  test("full legitimate transaction pipeline: Warrant -> Proposal -> Validation -> Policy -> Payment -> Audit", async () => {
    const context = createAppContext();
    const app = buildApp(context);

    // 1. Issue a signed warrant
    const warrantRes = await app.inject({
      method: "POST",
      url: "/api/warrants",
      payload: {
        warrantId: "w_e2e_01",
        principal: "akshay",
        agentId: "agent_grocery",
        allowedMerchants: ["freshmart"],
        allowedCategories: ["groceries"],
        perTransactionLimitMinorUnits: 200000, // ₹2000.00
        dailyLimitMinorUnits: 500000, // ₹5000.00
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      },
    });

    assert.equal(warrantRes.statusCode, 201);
    const signedWarrant = JSON.parse(warrantRes.body);
    assert.ok(signedWarrant.signature);

    // 2. Execute a transaction via the pipeline
    const txnRes = await app.inject({
      method: "POST",
      url: "/api/transactions/execute",
      payload: {
        warrantId: "w_e2e_01",
        agentId: "agent_grocery",
        merchantId: "freshmart",
        category: "groceries",
        sku: "milk-2l",
        amountMinorUnits: 1284, // ₹12.84
      },
    });

    assert.equal(txnRes.statusCode, 200);
    const txnBody = JSON.parse(txnRes.body);

    assert.equal(txnBody.success, true);
    assert.equal(txnBody.stage, "COMPLETED");
    assert.equal(txnBody.proposalValidation.valid, true);
    assert.equal(txnBody.decision.outcome, "ALLOW");
    assert.equal(txnBody.decision.reason, "POLICY_SATISFIED");
    assert.equal(txnBody.payment.status, "SUCCESS");
    assert.ok(txnBody.payment.paymentId.startsWith("pay_test_"));

    // 3. Verify Warrant Spending State updated
    const warrantStatusRes = await app.inject({
      method: "GET",
      url: "/api/warrants/w_e2e_01",
    });
    const warrantStatus = JSON.parse(warrantStatusRes.body);
    assert.equal(warrantStatus.spending.spentTodayMinorUnits, 1284);
    assert.equal(warrantStatus.spending.processedTransactionsCount, 1);

    // 4. Verify Audit Trail and Integrity
    const auditRes = await app.inject({
      method: "GET",
      url: "/api/audit",
      query: { warrantId: "w_e2e_01" },
    });
    const auditBody = JSON.parse(auditRes.body);
    assert.ok(auditBody.events.length >= 4);

    const integrityRes = await app.inject({
      method: "GET",
      url: "/api/audit/integrity",
    });
    const integrityBody = JSON.parse(integrityRes.body);
    assert.equal(integrityBody.valid, true);
  });
});
