import type { MerchantId, SignedWarrant, TransactionRequest } from "../domain/types.js";
import { asMerchantId, asTransactionId } from "../domain/types.js";
import { getProduct } from "../catalog/catalog.js";
import type { Product } from "../catalog/types.js";
import { AGENT_SYSTEM_PROMPT } from "./prompts/system.js";
import { executeTool } from "./tools.js";
import { geminiApiKey, runGeminiProposer, type GeminiContent } from "./llm.js";

export type AgentAttackMode =
  | "NONE"
  | "PRICE_TAMPER"
  | "MERCHANT_SPOOF"
  | "CATEGORY_SPOOF"
  | "LIMIT_BYPASS";

export interface ConversationTurn {
  readonly role: "user" | "model";
  readonly text: string;
}

/**
 * Authoritative feedback from the deterministic policy engine about a
 * previously BLOCKED proposal. The agent may use it to revise its proposal,
 * but it can never influence the authorization decision itself.
 */
export interface PolicyFeedback {
  readonly attempt: number;
  readonly reason: string;
  readonly reasonDescription: string;
  readonly blockedAmountMinorUnits: number;
  readonly remainingDailyMinorUnits: number;
}

export interface SpendingContext {
  readonly spentTodayMinorUnits: number;
  readonly remainingDailyMinorUnits: number;
}

export interface AgentRunOptions {
  readonly userMessage: string;
  readonly warrant: SignedWarrant;
  readonly history?: readonly ConversationTurn[];
  readonly policyFeedback?: PolicyFeedback | undefined;
  readonly spendingContext?: SpendingContext | undefined;
  readonly simulateAttack?: AgentAttackMode | undefined;
}

export interface AgentRunResult {
  readonly responseText: string;
  readonly engine: "GEMINI" | "HEURISTIC";
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

interface ProposalFields {
  readonly merchantId: MerchantId;
  readonly category: string;
  readonly amountMinorUnits: number;
}

function buildWarrantBrief(options: AgentRunOptions): string {
  const { payload } = options.warrant;
  const lines = [
    `CURRENT WARRANT CONTEXT (authoritative):`,
    `- warrantId: ${payload.warrantId}`,
    `- agentId: ${payload.agentId}`,
    `- allowed merchants: ${payload.allowedMerchants.join(", ")}`,
    `- allowed categories: ${payload.allowedCategories.join(", ")}`,
    `- per-transaction limit: ₹${(payload.perTransactionLimit.minorUnits / 100).toFixed(2)}`,
    `- daily limit: ₹${(payload.dailyLimit.minorUnits / 100).toFixed(2)}`,
  ];
  if (options.spendingContext) {
    lines.push(
      `- already spent today: ₹${(options.spendingContext.spentTodayMinorUnits / 100).toFixed(2)}`,
      `- remaining daily budget: ₹${(options.spendingContext.remainingDailyMinorUnits / 100).toFixed(2)}`,
    );
  }
  return lines.join("\n");
}

function buildFeedbackBrief(feedback: PolicyFeedback): string {
  return [
    "POLICY ENGINE FEEDBACK (deterministic, non-negotiable):",
    `Your previous transaction proposal was BLOCKED.`,
    `- blocked amount: ₹${(feedback.blockedAmountMinorUnits / 100).toFixed(2)}`,
    `- block reason: ${feedback.reason}`,
    `- explanation: ${feedback.reasonDescription}`,
    `- remaining daily budget: ₹${(feedback.remainingDailyMinorUnits / 100).toFixed(2)}`,
    feedback.attempt > 1
      ? `This is revision attempt ${feedback.attempt}. If no legitimate revision exists, explain the constraint to the user instead of proposing again.`
      : "Revise your proposal so it complies, or explain to the user why their request cannot be authorized.",
  ].join("\n");
}

export class AgentRunner {
  async run(options: AgentRunOptions): Promise<AgentRunResult> {
    if (geminiApiKey()) {
      try {
        return await this.runWithGemini(options);
      } catch (error) {
        console.error("[agent] Gemini proposer failed, falling back to heuristic:", error);
      }
    }
    return this.runHeuristic(options);
  }

  private async runWithGemini(options: AgentRunOptions): Promise<AgentRunResult> {
    const { payload } = options.warrant;

    const contents: GeminiContent[] = [];
    for (const turn of options.history ?? []) {
      if (turn.text.trim()) contents.push({ role: turn.role, parts: [{ text: turn.text }] });
    }
    contents.push({ role: "user", parts: [{ text: options.userMessage }] });

    const contextParts = [buildWarrantBrief(options)];
    if (options.policyFeedback) contextParts.push(buildFeedbackBrief(options.policyFeedback));
    contents.push({ role: "user", parts: [{ text: contextParts.join("\n\n") }] });

    const loop = await runGeminiProposer(AGENT_SYSTEM_PROMPT, contents);

    if (!loop.proposalArgs) {
      return {
        responseText: loop.text || "I could not formulate a proposal for this request.",
        engine: "GEMINI",
        toolCalls: loop.toolCalls,
      };
    }

    const args = loop.proposalArgs;
    const product = getProduct(args.sku);
    if (!product || !product.available) {
      return {
        responseText:
          loop.text ||
          (product
            ? `I found ${product.name}, but it is currently out of stock.`
            : `I could not verify a catalog product for SKU '${args.sku}', so I will not propose this transaction.`),
        engine: "GEMINI",
        toolCalls: loop.toolCalls,
      };
    }

    // The attack simulation is an explicit demo switch applied AFTER the model
    // produces a clean proposal; it demonstrates deterministic rejection.
    const simulated = this.applyAttackSimulation(
      asMerchantId(args.merchantId),
      args.category,
      args.amountMinorUnits,
      payload.perTransactionLimit.minorUnits,
      options.simulateAttack ?? "NONE",
    );

    const proposalArgs = {
      warrantId: payload.warrantId,
      agentId: payload.agentId,
      merchantId: simulated.merchantId,
      sku: product.sku,
      category: simulated.category,
      amountMinorUnits: simulated.amountMinorUnits,
    };
    const proposalRes = executeTool("create_transaction_proposal", proposalArgs);
    const toolCalls = [
      ...loop.toolCalls,
      {
        name: "create_transaction_proposal",
        args: proposalArgs as Record<string, unknown>,
        result: proposalRes,
      },
    ];

    return {
      responseText:
        loop.text ||
        `I found ${product.name} at ₹${(simulated.amountMinorUnits / 100).toFixed(2)} and formulated a transaction proposal under Warrant ${payload.warrantId}.`,
      engine: "GEMINI",
      proposal: {
        request: this.buildRequest(payload, simulated, product.sku),
        product,
      },
      toolCalls,
    };
  }

  /**
   * Deterministic keyword-based proposer used when no LLM credentials are
   * configured (tests, offline demos). Incorporates policy feedback by
   * constraining selection to affordable products within remaining budget.
   */
  private async runHeuristic(options: AgentRunOptions): Promise<AgentRunResult> {
    const { userMessage, warrant, policyFeedback, spendingContext } = options;
    const { payload } = warrant;
    const toolCalls: Array<{ name: string; args: Record<string, unknown>; result: unknown }> = [];
    let notes = "";

    let searchKeyword = "";
    const lower = userMessage.toLowerCase();
    if (lower.includes("bread")) searchKeyword = "bread";
    else if (lower.includes("egg")) searchKeyword = "eggs";
    else if (lower.includes("cable") || lower.includes("usb") || lower.includes("charger")) searchKeyword = "cable";
    else if (lower.includes("coffee")) searchKeyword = "coffee";
    else searchKeyword = "milk";

    let products: Product[] = [];
    if (policyFeedback && spendingContext) {
      notes = ` My previous proposal was blocked (${policyFeedback.reason}). I have revised it to fit within your remaining daily budget of ₹${(spendingContext.remainingDailyMinorUnits / 100).toFixed(2)}.`;
      const allRes = executeTool("search_products", { query: "" }) as { products?: Product[] };
      toolCalls.push({ name: "search_products", args: { query: "" }, result: allRes });
      const budget = Math.min(
        payload.perTransactionLimit.minorUnits,
        spendingContext.remainingDailyMinorUnits,
      );
      products = [...(allRes.products ?? [])]
        .filter((p) => p.available && p.priceMinorUnits <= budget)
        .sort((a, b) => a.priceMinorUnits - b.priceMinorUnits);
      if (products.length === 0) {
        return {
          responseText:
            `I couldn't complete your original request: it was blocked (${policyFeedback.reason}) and no catalog product fits within your remaining daily budget of ₹${(budget / 100).toFixed(2)}.`,
          engine: "HEURISTIC",
          toolCalls,
        };
      }
    } else {
      const searchArgs = { query: searchKeyword };
      const searchRes = executeTool("search_products", searchArgs) as { products?: Product[] };
      toolCalls.push({ name: "search_products", args: searchArgs, result: searchRes });
      products = searchRes.products ?? [];
    }

    if (products.length === 0) {
      return {
        responseText: `I couldn't find any products matching "${userMessage}" in the merchant catalog.`,
        engine: "HEURISTIC",
        toolCalls,
      };
    }

    const selectedProduct = products[0]!;
    if (!selectedProduct.available) {
      return {
        responseText: `I found ${selectedProduct.name}, but it is currently out of stock.`,
        engine: "HEURISTIC",
        toolCalls,
      };
    }

    const simulated = this.applyAttackSimulation(
      selectedProduct.merchantId,
      selectedProduct.category,
      selectedProduct.priceMinorUnits,
      payload.perTransactionLimit.minorUnits,
      options.simulateAttack ?? "NONE",
    );

    const proposalArgs = {
      warrantId: payload.warrantId,
      agentId: payload.agentId,
      merchantId: simulated.merchantId,
      sku: selectedProduct.sku,
      category: simulated.category,
      amountMinorUnits: simulated.amountMinorUnits,
    };
    const proposalRes = executeTool("create_transaction_proposal", proposalArgs);
    toolCalls.push({
      name: "create_transaction_proposal",
      args: proposalArgs as Record<string, unknown>,
      result: proposalRes,
    });

    return {
      responseText: `I found ${selectedProduct.name} at ₹${(simulated.amountMinorUnits / 100).toFixed(2)}.${notes} I have formulated a transaction proposal for authorization under Warrant ${payload.warrantId}.`,
      engine: "HEURISTIC",
      proposal: {
        request: this.buildRequest(payload, simulated, selectedProduct.sku),
        product: selectedProduct,
      },
      toolCalls,
    };
  }

  private buildRequest(
    payload: SignedWarrant["payload"],
    fields: ProposalFields,
    sku: string,
  ): TransactionRequest {
    return {
      transactionId: asTransactionId(`txn_${Date.now()}_${Math.floor(Math.random() * 1000)}`),
      warrantId: payload.warrantId,
      agentId: payload.agentId,
      merchantId: fields.merchantId,
      category: fields.category,
      sku,
      amount: {
        minorUnits: fields.amountMinorUnits,
        currency: payload.perTransactionLimit.currency,
      },
      requestedAt: new Date().toISOString(),
    };
  }

  private applyAttackSimulation(
    merchantId: MerchantId,
    category: string,
    amountMinorUnits: number,
    perTransactionLimitMinorUnits: number,
    simulateAttack: AgentAttackMode,
  ): ProposalFields {
    switch (simulateAttack) {
      case "PRICE_TAMPER":
        return { merchantId, category, amountMinorUnits: 100 };
      case "MERCHANT_SPOOF":
        return { merchantId: asMerchantId("unauthorized_mart"), category, amountMinorUnits };
      case "CATEGORY_SPOOF":
        return { merchantId, category: "electronics", amountMinorUnits };
      case "LIMIT_BYPASS":
        return { merchantId, category, amountMinorUnits: perTransactionLimitMinorUnits + 50000 };
      default:
        return { merchantId, category, amountMinorUnits };
    }
  }
}
