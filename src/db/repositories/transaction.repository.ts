import { desc, eq } from "drizzle-orm";
import type {
  AgentId,
  CurrencyCode,
  DecisionReason,
  MerchantId,
  TransactionId,
  WarrantId,
} from "../../domain/types.js";
import {
  asAgentId,
  asMerchantId,
  asTransactionId,
  asWarrantId,
} from "../../domain/types.js";
import type { Database } from "../client.js";
import { transactionsTable } from "../schema/index.js";

export interface TransactionRecord {
  readonly transactionId: TransactionId;
  readonly warrantId: WarrantId;
  readonly agentId: AgentId;
  readonly merchantId: MerchantId;
  readonly category: string;
  readonly sku: string;
  readonly amountMinorUnits: number;
  readonly currency: CurrencyCode;
  readonly outcome: "ALLOW" | "BLOCK";
  readonly reason: DecisionReason | string;
  readonly paymentId?: string | undefined;
  readonly paymentStatus?: string | undefined;
  readonly requestedAt: string;
  readonly processedAt: string;
}

export interface TransactionRepository {
  save(tx: TransactionRecord): Promise<TransactionRecord>;
  getById(transactionId: TransactionId): Promise<TransactionRecord | null>;
  list(filter?: { warrantId?: WarrantId }): Promise<readonly TransactionRecord[]>;
}

export class InMemoryTransactionRepository implements TransactionRepository {
  private readonly transactions = new Map<TransactionId, TransactionRecord>();

  async save(tx: TransactionRecord): Promise<TransactionRecord> {
    this.transactions.set(tx.transactionId, tx);
    return tx;
  }

  async getById(transactionId: TransactionId): Promise<TransactionRecord | null> {
    return this.transactions.get(transactionId) ?? null;
  }

  async list(filter?: { warrantId?: WarrantId }): Promise<readonly TransactionRecord[]> {
    let list = Array.from(this.transactions.values());
    if (filter?.warrantId) {
      list = list.filter((tx) => tx.warrantId === filter.warrantId);
    }
    return list.sort((a, b) => Date.parse(b.processedAt) - Date.parse(a.processedAt));
  }
}

export class PgTransactionRepository implements TransactionRepository {
  constructor(private readonly db: Database) {}

  async save(tx: TransactionRecord): Promise<TransactionRecord> {
    await this.db
      .insert(transactionsTable)
      .values({
        transactionId: tx.transactionId,
        warrantId: tx.warrantId,
        agentId: tx.agentId,
        merchantId: tx.merchantId,
        category: tx.category,
        sku: tx.sku,
        amountMinorUnits: tx.amountMinorUnits,
        currency: tx.currency,
        outcome: tx.outcome,
        reason: tx.reason,
        paymentId: tx.paymentId,
        paymentStatus: tx.paymentStatus,
        requestedAt: tx.requestedAt,
        processedAt: tx.processedAt,
      })
      .onConflictDoUpdate({
        target: transactionsTable.transactionId,
        set: {
          outcome: tx.outcome,
          reason: tx.reason,
          paymentId: tx.paymentId,
          paymentStatus: tx.paymentStatus,
        },
      });

    return tx;
  }

  async getById(transactionId: TransactionId): Promise<TransactionRecord | null> {
    const rows = await this.db
      .select()
      .from(transactionsTable)
      .where(eq(transactionsTable.transactionId, transactionId))
      .limit(1);

    const row = rows[0];
    if (!row) return null;

    return {
      transactionId: asTransactionId(row.transactionId),
      warrantId: asWarrantId(row.warrantId),
      agentId: asAgentId(row.agentId),
      merchantId: asMerchantId(row.merchantId),
      category: row.category,
      sku: row.sku,
      amountMinorUnits: Number(row.amountMinorUnits),
      currency: row.currency as CurrencyCode,
      outcome: row.outcome as "ALLOW" | "BLOCK",
      reason: row.reason as DecisionReason,
      paymentId: row.paymentId ?? undefined,
      paymentStatus: row.paymentStatus ?? undefined,
      requestedAt: row.requestedAt,
      processedAt: row.processedAt,
    };
  }

  async list(filter?: { warrantId?: WarrantId }): Promise<readonly TransactionRecord[]> {
    let query = this.db.select().from(transactionsTable);

    if (filter?.warrantId) {
      query = query.where(eq(transactionsTable.warrantId, filter.warrantId)) as typeof query;
    }

    const rows = await query.orderBy(desc(transactionsTable.processedAt));

    return rows.map((row) => ({
      transactionId: asTransactionId(row.transactionId),
      warrantId: asWarrantId(row.warrantId),
      agentId: asAgentId(row.agentId),
      merchantId: asMerchantId(row.merchantId),
      category: row.category,
      sku: row.sku,
      amountMinorUnits: Number(row.amountMinorUnits),
      currency: row.currency as CurrencyCode,
      outcome: row.outcome as "ALLOW" | "BLOCK",
      reason: row.reason as DecisionReason,
      paymentId: row.paymentId ?? undefined,
      paymentStatus: row.paymentStatus ?? undefined,
      requestedAt: row.requestedAt,
      processedAt: row.processedAt,
    }));
  }
}
