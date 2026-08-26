import type { SignedWarrant, TransactionRequest } from "../domain/types.js";
import { asAgentId, asMerchantId, asTransactionId, asWarrantId, money } from "../domain/types.js";
import { executeTool } from "./tools.js";
import type { Product } from "../catalog/types.js";

export interface AgentRunOptions {
  readonly userMessage: string;
  readonly warrant: SignedWarrant;
  readonly simulateAttack?: "NONE" | "PRICE_TAMPER" | "MERCHANT_SPOOF" | "CATEGORY_SPOOF" | "LIMIT_BYPASS" | undefined;
}

export interface AgentRunResult {
  readonly responseText: string;
  readonly proposal?: {
    readonly request: TransactionRequest;
    readonly product: Product;
  } | undefined;
  readonly toolCalls: Array<{
    readonly name: string;
    readonly args: Record<string, unknown>;
    readonly result: unknown;
  }>;
}

export class AgentRunner {
  /**
   * Run the agent on a user message within the context of a signed spending warrant.
   */
  async run(options: AgentRunOptions): Promise<AgentRunResult> {
    const { userMessage, warrant, simulateAttack = "NONE" } = options;
    const { payload } = warrant;
    const toolCalls: Array<{ name: string; args: Record<string, unknown>; result: unknown }> = [];

    // Step 1: Search products based on user intent keywords
    let searchKeyword = "milk";
    const lower = userMessage.toLowerCase();
    if (lower.includes("bread")) searchKeyword = "bread";
    else if (lower.includes("egg")) searchKeyword = "eggs";
    else if (lower.includes("cable") || lower.includes("usb")) searchKeyword = "cable";
    else if (lower.includes("coffee")) searchKeyword = "coffee";

    const searchArgs = { query: searchKeyword };
    const searchRes = executeTool("search_products", searchArgs) as { products?: Product[] };
    toolCalls.push({ name: "search_products", args: searchArgs, result: searchRes });

    const products = searchRes.products ?? [];
    if (products.length === 0) {
      return {
        responseText: `I couldn't find any products matching "${userMessage}" in the merchant catalog.`,
        toolCalls,
      };
    }

    // Select the best matching product
    const selectedProduct = products[0]!;

    if (!selectedProduct.available) {
      return {
        responseText: `I found ${selectedProduct.name}, but it is currently out of stock.`,
        toolCalls,
      };
    }

    // Prepare proposal parameters
    let merchantId = selectedProduct.merchantId;
    let category = selectedProduct.category;
    let amountMinorUnits = selectedProduct.priceMinorUnits;

    // Apply attack simulations if requested
    if (simulateAttack === "PRICE_TAMPER") {
      amountMinorUnits = 100; // Agent attempts to claim a ₹12.84 product costs ₹1.00
    } else if (simulateAttack === "MERCHANT_SPOOF") {
      merchantId = asMerchantId("unauthorized_mart");
    } else if (simulateAttack === "CATEGORY_SPOOF") {
      category = "electronics"; // Spoof category
    } else if (simulateAttack === "LIMIT_BYPASS") {
      amountMinorUnits = payload.perTransactionLimit.minorUnits + 50000;
    }

    const proposalArgs = {
      warrantId: payload.warrantId,
      agentId: payload.agentId,
      merchantId,
      sku: selectedProduct.sku,
      category,
      amountMinorUnits,
    };

    const proposalRes = executeTool("create_transaction_proposal", proposalArgs);
    toolCalls.push({ name: "create_transaction_proposal", args: proposalArgs, result: proposalRes });

    const transactionId = asTransactionId(`txn_${Date.now()}_${Math.floor(Math.random() * 1000)}`);

    const request: TransactionRequest = {
      transactionId,
      warrantId: payload.warrantId,
      agentId: payload.agentId,
      merchantId,
      category,
      sku: selectedProduct.sku,
      amount: {
        minorUnits: amountMinorUnits,
        currency: payload.perTransactionLimit.currency,
      },
      requestedAt: new Date().toISOString(),
    };

    return {
      responseText: `I found ${selectedProduct.name} at ₹${(amountMinorUnits / 100).toFixed(2)}. I have formulated a transaction proposal for authorization under Warrant ${payload.warrantId}.`,
      proposal: {
        request,
        product: selectedProduct,
      },
      toolCalls,
    };
  }
}
