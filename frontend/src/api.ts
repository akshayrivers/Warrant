import type {
  AgentRunResult,
  AuditEvent,
  Catalog,
  ExecuteTransactionResponse,
  IntegrityCheckResult,
  Product,
  ProposalValidation,
  SignedWarrant,
  TransactionProposal,
  TransactionRecord,
  WarrantWithSpending,
} from "./types";

const BASE_URL = "";

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const errorText = await res.text();
    let errorMsg = `HTTP Error ${res.status}`;
    try {
      const parsed = JSON.parse(errorText);
      errorMsg = parsed.message || parsed.error || errorMsg;
    } catch {
      errorMsg = errorText || errorMsg;
    }
    throw new Error(errorMsg);
  }
  return res.json() as Promise<T>;
}

export const api = {
  // Warrants
  async getWarrants(): Promise<SignedWarrant[]> {
    const res = await fetch(`${BASE_URL}/api/warrants`);
    const data = await handleResponse<{ warrants: SignedWarrant[] }>(res);
    return data.warrants;
  },

  async getWarrant(warrantId: string): Promise<WarrantWithSpending> {
    const res = await fetch(`${BASE_URL}/api/warrants/${encodeURIComponent(warrantId)}`);
    return handleResponse<WarrantWithSpending>(res);
  },

  async createWarrant(payload: {
    warrantId?: string;
    principal: string;
    agentId: string;
    allowedMerchants: string[];
    allowedCategories: string[];
    perTransactionLimitMinorUnits: number;
    dailyLimitMinorUnits: number;
    expiresAt: string;
  }): Promise<SignedWarrant> {
    const res = await fetch(`${BASE_URL}/api/warrants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return handleResponse<SignedWarrant>(res);
  },

  // Catalog
  async getCatalog(): Promise<Catalog[]> {
    const res = await fetch(`${BASE_URL}/api/catalog`);
    const data = await handleResponse<{ catalogs: Catalog[] }>(res);
    return data.catalogs;
  },

  async getProducts(): Promise<Product[]> {
    const res = await fetch(`${BASE_URL}/api/catalog/products`);
    const data = await handleResponse<{ products: Product[] }>(res);
    return data.products;
  },

  // Transactions
  async getTransactions(warrantId?: string): Promise<TransactionRecord[]> {
    const url = warrantId
      ? `${BASE_URL}/api/transactions?warrantId=${encodeURIComponent(warrantId)}`
      : `${BASE_URL}/api/transactions`;
    const res = await fetch(url);
    const data = await handleResponse<{ transactions: TransactionRecord[] }>(res);
    return data.transactions;
  },

  // Proposal Validation
  async validateProposal(proposal: TransactionProposal): Promise<ProposalValidation> {
    const res = await fetch(`${BASE_URL}/api/proposals/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(proposal),
    });
    return handleResponse<ProposalValidation>(res);
  },

  // Full Pipeline Execution
  async executeTransaction(params: {
    warrantId: string;
    transactionId?: string;
    agentId: string;
    merchantId: string;
    category: string;
    sku: string;
    amountMinorUnits: number;
    signedWarrant?: SignedWarrant;
  }): Promise<ExecuteTransactionResponse> {
    const res = await fetch(`${BASE_URL}/api/transactions/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    return handleResponse<ExecuteTransactionResponse>(res);
  },

  // Audit
  async getAuditEvents(filter?: {
    warrantId?: string;
    transactionId?: string;
    limit?: number;
  }): Promise<AuditEvent[]> {
    const params = new URLSearchParams();
    if (filter?.warrantId) params.set("warrantId", filter.warrantId);
    if (filter?.transactionId) params.set("transactionId", filter.transactionId);
    if (filter?.limit) params.set("limit", String(filter.limit));

    const qs = params.toString();
    const url = qs ? `${BASE_URL}/api/audit?${qs}` : `${BASE_URL}/api/audit`;
    const res = await fetch(url);
    const data = await handleResponse<{ events: AuditEvent[] }>(res);
    return data.events;
  },

  async getAuditIntegrity(): Promise<IntegrityCheckResult> {
    const res = await fetch(`${BASE_URL}/api/audit/integrity`);
    return handleResponse<IntegrityCheckResult>(res);
  },

  // Agent
  async agentInteract(params: {
    userMessage: string;
    warrantId: string;
    simulateAttack?: "NONE" | "PRICE_TAMPER" | "MERCHANT_SPOOF" | "CATEGORY_SPOOF" | "LIMIT_BYPASS";
  }): Promise<AgentRunResult> {
    const res = await fetch(`${BASE_URL}/api/agent/interact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    return handleResponse<AgentRunResult>(res);
  },
};
