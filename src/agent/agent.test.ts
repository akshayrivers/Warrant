import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { asAgentId, asMerchantId, asWarrantId, money } from "../domain/types.js";
import { signWarrant } from "../warrant/sign.js";
import { AgentRunner } from "./agent.js";
import { executeTool } from "./tools.js";

const SECRET = "secret-123";

describe("Agent & Tool Execution", () => {
  test("tools can search products and get details", () => {
    const searchRes = executeTool("search_products", { query: "milk" }) as { products: Array<{ sku: string }> };
    assert.ok(searchRes.products.length > 0);
    assert.equal(searchRes.products[0]?.sku, "milk-2l");

    const detailRes = executeTool("get_product_details", { sku: "milk-2l" }) as { product: { name: string } };
    assert.equal(detailRes.product.name, "Fresh Milk 2L");
  });

  test("agent runner formulates valid proposal from user intent", async () => {
    const warrant = signWarrant(
      {
        warrantId: asWarrantId("w_01"),
        principal: "alice",
        agentId: asAgentId("agent_01"),
        allowedMerchants: [asMerchantId("freshmart")],
        allowedCategories: ["groceries"],
        perTransactionLimit: money(2000),
        dailyLimit: money(5000),
        issuedAt: "2026-08-25T00:00:00Z",
        expiresAt: "2026-08-30T00:00:00Z",
      },
      SECRET,
    );

    const runner = new AgentRunner();
    const result = await runner.run({
      userMessage: "Please buy 2 litres of fresh milk",
      warrant,
    });

    assert.ok(result.proposal);
    assert.equal(result.proposal.product.sku, "milk-2l");
    assert.equal(result.proposal.request.merchantId, asMerchantId("freshmart"));
    assert.equal(result.proposal.request.amount.minorUnits, 1284);
    assert.equal(result.toolCalls.length, 2);
  });

  test("agent runner simulates price tampering attack", async () => {
    const warrant = signWarrant(
      {
        warrantId: asWarrantId("w_01"),
        principal: "alice",
        agentId: asAgentId("agent_01"),
        allowedMerchants: [asMerchantId("freshmart")],
        allowedCategories: ["groceries"],
        perTransactionLimit: money(2000),
        dailyLimit: money(5000),
        issuedAt: "2026-08-25T00:00:00Z",
        expiresAt: "2026-08-30T00:00:00Z",
      },
      SECRET,
    );

    const runner = new AgentRunner();
    const result = await runner.run({
      userMessage: "Please buy milk",
      warrant,
      simulateAttack: "PRICE_TAMPER",
    });

    assert.ok(result.proposal);
    // Price should be tampered to 100 instead of 1284
    assert.equal(result.proposal.request.amount.minorUnits, 100);
  });
});
