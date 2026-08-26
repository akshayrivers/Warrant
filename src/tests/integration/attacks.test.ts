import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { buildApp } from "../../server/app.js";
import { createAppContext } from "../../server/context.js";

describe("Adversarial Attack Scenarios & Boundary Tests", () => {
  const setupAppWithWarrant = async () => {
    const context = createAppContext();
    const app = buildApp(context);

    const warrantRes = await app.inject({
      method: "POST",
      url: "/api/warrants",
      payload: {
        warrantId: "w_attack_01",
        principal: "alice",
        agentId: "agent_grocery",
        allowedMerchants: ["freshmart"],
        allowedCategories: ["groceries"],
        perTransactionLimitMinorUnits: 1500, // ₹15.00 limit
        dailyLimitMinorUnits: 2500, // ₹25.00 daily limit
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      },
    });

    const signedWarrant = JSON.parse(warrantRes.body);
    return { app, context, signedWarrant };
  };

  test("Attack 1: Hallucinated product SKU is blocked by Proposal Validation", async () => {
    const { app } = await setupAppWithWarrant();

    const res = await app.inject({
      method: "POST",
      url: "/api/transactions/execute",
      payload: {
        warrantId: "w_attack_01",
        agentId: "agent_grocery",
        merchantId: "freshmart",
        category: "groceries",
        sku: "non-existent-sku-xyz",
        amountMinorUnits: 500,
      },
    });

    const body = JSON.parse(res.body);
    assert.equal(body.success, false);
    assert.equal(body.stage, "PROPOSAL_VALIDATION");
    assert.equal(body.decision.outcome, "BLOCK");
    assert.equal(body.decision.reason, "PRODUCT_NOT_FOUND");
    assert.equal(body.payment, null);
  });

  test("Attack 2: Price Manipulation (understating price) is blocked by Proposal Validation", async () => {
    const { app } = await setupAppWithWarrant();

    const res = await app.inject({
      method: "POST",
      url: "/api/transactions/execute",
      payload: {
        warrantId: "w_attack_01",
        agentId: "agent_grocery",
        merchantId: "freshmart",
        category: "groceries",
        sku: "milk-2l", // True price is 1284 paise (₹12.84)
        amountMinorUnits: 100, // Agent claims it is ₹1.00
      },
    });

    const body = JSON.parse(res.body);
    assert.equal(body.success, false);
    assert.equal(body.stage, "PROPOSAL_VALIDATION");
    assert.equal(body.decision.outcome, "BLOCK");
    assert.equal(body.decision.reason, "PRICE_MISMATCH");
    assert.equal(body.payment, null);
  });

  test("Attack 3: Merchant Spoofing is blocked by Proposal Validation", async () => {
    const { app } = await setupAppWithWarrant();

    const res = await app.inject({
      method: "POST",
      url: "/api/transactions/execute",
      payload: {
        warrantId: "w_attack_01",
        agentId: "agent_grocery",
        merchantId: "techmart", // Milk belongs to freshmart, not techmart
        category: "groceries",
        sku: "milk-2l",
        amountMinorUnits: 1284,
      },
    });

    const body = JSON.parse(res.body);
    assert.equal(body.success, false);
    assert.equal(body.stage, "PROPOSAL_VALIDATION");
    assert.equal(body.decision.outcome, "BLOCK");
    assert.equal(body.decision.reason, "MERCHANT_MISMATCH");
  });

  test("Attack 4: Per-Transaction Limit Bypass is blocked by Policy Engine", async () => {
    const { app } = await setupAppWithWarrant();

    await app.inject({
      method: "POST",
      url: "/api/warrants",
      payload: {
        warrantId: "w_low_limit",
        principal: "alice",
        agentId: "agent_grocery",
        allowedMerchants: ["freshmart"],
        allowedCategories: ["groceries"],
        perTransactionLimitMinorUnits: 500, // Only ₹5.00 allowed
        dailyLimitMinorUnits: 2500,
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      },
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/transactions/execute",
      payload: {
        warrantId: "w_low_limit",
        agentId: "agent_grocery",
        merchantId: "freshmart",
        category: "groceries",
        sku: "milk-2l", // Price is 1284 (> 500)
        amountMinorUnits: 1284,
      },
    });

    const body = JSON.parse(res.body);
    assert.equal(body.success, false);
    assert.equal(body.stage, "POLICY_EVALUATION");
    assert.equal(body.decision.outcome, "BLOCK");
    assert.equal(body.decision.reason, "TRANSACTION_LIMIT_EXCEEDED");
    assert.equal(body.payment, null);
  });

  test("Attack 5: Cumulative Daily Limit Exhaustion is blocked by Policy Engine", async () => {
    const { app } = await setupAppWithWarrant();

    // Daily limit is 2500 paise (₹25.00). Per-transaction limit is 1500 (₹15.00).
    // Txn 1: Milk (1284 paise) -> OK (Remaining = 1216)
    const res1 = await app.inject({
      method: "POST",
      url: "/api/transactions/execute",
      payload: {
        warrantId: "w_attack_01",
        transactionId: "tx_first_order",
        agentId: "agent_grocery",
        merchantId: "freshmart",
        category: "groceries",
        sku: "milk-2l",
        amountMinorUnits: 1284,
      },
    });
    assert.equal(JSON.parse(res1.body).decision.outcome, "ALLOW");

    // Txn 2: Bread (450 paise) -> OK (Remaining = 766)
    const res2 = await app.inject({
      method: "POST",
      url: "/api/transactions/execute",
      payload: {
        warrantId: "w_attack_01",
        transactionId: "tx_second_order",
        agentId: "agent_grocery",
        merchantId: "freshmart",
        category: "groceries",
        sku: "bread-white",
        amountMinorUnits: 450,
      },
    });
    assert.equal(JSON.parse(res2.body).decision.outcome, "ALLOW");

    // Txn 3: Farm Eggs (720 paise) -> Total would be 1284 + 450 + 720 = 2454 <= 2500 -> OK
    const res3 = await app.inject({
      method: "POST",
      url: "/api/transactions/execute",
      payload: {
        warrantId: "w_attack_01",
        transactionId: "tx_third_order",
        agentId: "agent_grocery",
        merchantId: "freshmart",
        category: "groceries",
        sku: "eggs-12",
        amountMinorUnits: 720,
      },
    });
    assert.equal(JSON.parse(res3.body).decision.outcome, "ALLOW");

    // Txn 4: Bread (450 paise) -> Total would be 2454 + 450 = 2904 > 2500 -> BLOCK!
    const res4 = await app.inject({
      method: "POST",
      url: "/api/transactions/execute",
      payload: {
        warrantId: "w_attack_01",
        transactionId: "tx_fourth_order",
        agentId: "agent_grocery",
        merchantId: "freshmart",
        category: "groceries",
        sku: "bread-white",
        amountMinorUnits: 450,
      },
    });
    const body4 = JSON.parse(res4.body);
    assert.equal(body4.success, false);
    assert.equal(body4.stage, "POLICY_EVALUATION");
    assert.equal(body4.decision.outcome, "BLOCK");
    assert.equal(body4.decision.reason, "DAILY_LIMIT_EXCEEDED");
  });

  test("Attack 6: Transaction Replay is blocked by Policy Engine", async () => {
    const { app } = await setupAppWithWarrant();

    const payload = {
      warrantId: "w_attack_01",
      transactionId: "tx_replay_attempt_1",
      agentId: "agent_grocery",
      merchantId: "freshmart",
      category: "groceries",
      sku: "bread-white",
      amountMinorUnits: 450,
    };

    // First attempt: succeeds
    const res1 = await app.inject({
      method: "POST",
      url: "/api/transactions/execute",
      payload,
    });
    assert.equal(JSON.parse(res1.body).decision.outcome, "ALLOW");

    // Second attempt with exact same transactionId: blocked by replay protection
    const res2 = await app.inject({
      method: "POST",
      url: "/api/transactions/execute",
      payload,
    });
    const body2 = JSON.parse(res2.body);
    assert.equal(body2.success, false);
    assert.equal(body2.decision.outcome, "BLOCK");
    assert.equal(body2.decision.reason, "DUPLICATE_TRANSACTION");
  });

  test("Attack 7: Tampered Warrant Payload fails signature verification", async () => {
    const { app, signedWarrant } = await setupAppWithWarrant();

    // Attacker modifies the signed warrant payload to increase limit to 999999
    const tampered = {
      ...signedWarrant,
      payload: {
        ...signedWarrant.payload,
        perTransactionLimit: { minorUnits: 999999, currency: "INR" },
      },
    };

    const res = await app.inject({
      method: "POST",
      url: "/api/transactions/execute",
      payload: {
        warrantId: "w_attack_01",
        agentId: "agent_grocery",
        merchantId: "freshmart",
        category: "groceries",
        sku: "milk-2l",
        amountMinorUnits: 1284,
        signedWarrant: tampered,
      },
    });

    const body = JSON.parse(res.body);
    assert.equal(body.success, false);
    assert.equal(body.decision.outcome, "BLOCK");
    assert.equal(body.decision.reason, "INVALID_SIGNATURE");
  });
});
