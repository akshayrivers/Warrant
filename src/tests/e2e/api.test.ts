import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { buildApp } from "../../server/app.js";

describe("E2E API Endpoints", () => {
  const app = buildApp();

  test("GET /health returns healthy status", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.status, "ok");
  });

  test("GET /api/catalog returns merchants and products", async () => {
    const res = await app.inject({ method: "GET", url: "/api/catalog" });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.ok(Array.isArray(body.catalogs));
    assert.ok(body.catalogs.length >= 2);
  });

  test("GET /api/catalog/products returns flat list of products", async () => {
    const res = await app.inject({ method: "GET", url: "/api/catalog/products" });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.ok(Array.isArray(body.products));
    assert.ok(body.products.some((p: { sku: string }) => p.sku === "milk-2l"));
  });

  test("POST /api/proposals/validate validates proposals directly", async () => {
    const validRes = await app.inject({
      method: "POST",
      url: "/api/proposals/validate",
      payload: {
        merchantId: "freshmart",
        sku: "milk-2l",
        category: "groceries",
        amountMinorUnits: 1284,
      },
    });
    assert.equal(validRes.statusCode, 200);
    assert.equal(JSON.parse(validRes.body).valid, true);

    const invalidRes = await app.inject({
      method: "POST",
      url: "/api/proposals/validate",
      payload: {
        merchantId: "freshmart",
        sku: "milk-2l",
        category: "groceries",
        amountMinorUnits: 9999, // Wrong price
      },
    });
    assert.equal(invalidRes.statusCode, 200);
    assert.equal(JSON.parse(invalidRes.body).valid, false);
    assert.equal(JSON.parse(invalidRes.body).reason, "PRICE_MISMATCH");
  });

  test("POST /api/agent/auto-execute runs intent -> proposal -> pipeline", async () => {
    // 1. Issue a warrant first
    const warrantRes = await app.inject({
      method: "POST",
      url: "/api/warrants",
      payload: {
        warrantId: "w_agent_test",
        principal: "bob",
        agentId: "agent_grocery",
        allowedMerchants: ["freshmart"],
        allowedCategories: ["groceries"],
        perTransactionLimitMinorUnits: 200000,
        dailyLimitMinorUnits: 500000,
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      },
    });
    assert.equal(warrantRes.statusCode, 201);

    // 2. Run agent auto-execute
    const autoRes = await app.inject({
      method: "POST",
      url: "/api/agent/auto-execute",
      payload: {
        userMessage: "Can you buy fresh milk for me?",
        warrantId: "w_agent_test",
      },
    });

    assert.equal(autoRes.statusCode, 200);
    const autoBody = JSON.parse(autoRes.body);
    assert.ok(autoBody.agentResult);
    assert.ok(autoBody.pipelineResult);
    assert.equal(autoBody.pipelineResult.success, true);
    assert.equal(autoBody.pipelineResult.decision.outcome, "ALLOW");
  });
});
