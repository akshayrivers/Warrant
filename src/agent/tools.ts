import { catalogs, getCatalog, getMerchant, getProduct } from "../catalog/catalog.js";
import type { Category, Product } from "../catalog/types.js";
import { asAgentId, asMerchantId, asWarrantId } from "../domain/types.js";
import type { TransactionProposal } from "../catalog/validate.js";

export interface ToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly parameters: Record<string, unknown>;
}

export const AGENT_TOOLS: readonly ToolDefinition[] = [
  {
    name: "search_products",
    description: "Search for products in the merchant catalogs by keyword or category.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search keyword (e.g. 'milk', 'bread', 'cable')" },
        category: { type: "string", description: "Product category (e.g. 'groceries', 'electronics')" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_product_details",
    description: "Get detailed information about a product including SKU, merchant, category, availability and price.",
    parameters: {
      type: "object",
      properties: {
        sku: { type: "string", description: "The product SKU (e.g. 'milk-2l', 'bread-white')" },
      },
      required: ["sku"],
    },
  },
  {
    name: "get_merchant_catalog",
    description: "Retrieve the full list of products offered by a specific merchant.",
    parameters: {
      type: "object",
      properties: {
        merchantId: { type: "string", description: "The merchant ID (e.g. 'freshmart', 'techmart')" },
      },
      required: ["merchantId"],
    },
  },
  {
    name: "create_transaction_proposal",
    description: "Submit a transaction proposal for validation and authorization.",
    parameters: {
      type: "object",
      properties: {
        warrantId: { type: "string", description: "The warrant ID under which this transaction is proposed" },
        agentId: { type: "string", description: "The ID of the agent proposing the transaction" },
        merchantId: { type: "string", description: "The ID of the merchant offering the product" },
        sku: { type: "string", description: "The exact SKU of the product" },
        category: { type: "string", description: "The category of the product" },
        amountMinorUnits: { type: "number", description: "The price in minor units (paise)" },
      },
      required: ["warrantId", "agentId", "merchantId", "sku", "category", "amountMinorUnits"],
    },
  },
];

export interface ToolContext {
  warrantId?: string | undefined;
  agentId?: string | undefined;
}

export function executeTool(name: string, args: Record<string, any>): unknown {
  switch (name) {
    case "search_products": {
      const query = String(args["query"] || "").toLowerCase();
      const category = args["category"] ? String(args["category"]).toLowerCase() : undefined;

      const allProducts: Product[] = [];
      for (const catalog of catalogs) {
        for (const product of catalog.products) {
          const matchQuery =
            product.name.toLowerCase().includes(query) ||
            product.description.toLowerCase().includes(query) ||
            product.sku.toLowerCase().includes(query);
          const matchCategory = !category || product.category.toLowerCase() === category;

          if (matchQuery && matchCategory) {
            allProducts.push(product);
          }
        }
      }
      return { products: allProducts };
    }

    case "get_product_details": {
      const sku = String(args["sku"] || "");
      const product = getProduct(sku);
      if (!product) {
        return { error: `Product with SKU '${sku}' not found.` };
      }
      return { product };
    }

    case "get_merchant_catalog": {
      const merchantId = String(args["merchantId"] || "");
      const catalog = getCatalog(asMerchantId(merchantId));
      if (!catalog) {
        return { error: `Merchant '${merchantId}' not found.` };
      }
      return {
        merchant: catalog.merchant,
        products: catalog.products,
      };
    }

    case "create_transaction_proposal": {
      const proposal: TransactionProposal = {
        merchantId: asMerchantId(String(args["merchantId"])),
        sku: String(args["sku"]),
        category: String(args["category"]) as Category,
        amountMinorUnits: Number(args["amountMinorUnits"]),
      };

      return {
        success: true,
        proposal,
        warrantId: String(args["warrantId"]),
        agentId: String(args["agentId"]),
      };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}
