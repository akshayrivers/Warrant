import { and, eq } from "drizzle-orm";
import type { SpendingState, TransactionId, WarrantId } from "../../domain/types.js";
import { asTransactionId } from "../../domain/types.js";
import type { Database } from "../client.js";
import { spendingStateTable, transactionsTable } from "../schema/index.js";

export interface SpendingRepository {
  getSpendingState(warrantId: WarrantId, now?: Date): Promise<SpendingState>;
  recordAllowedTransaction(
    warrantId: WarrantId,
    transactionId: TransactionId,
    amountMinorUnits: number,
    now?: Date,
  ): Promise<SpendingState>;
}

function getDayString(d: Date): string {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

export class InMemorySpendingRepository implements SpendingRepository {
  private readonly spendingByWarrant = new Map<
    WarrantId,
    { spentTodayMinorUnits: number; lastDate: string }
  >();
  private readonly processedTxnsByWarrant = new Map<WarrantId, Set<TransactionId>>();

  async getSpendingState(warrantId: WarrantId, now: Date = new Date()): Promise<SpendingState> {
    const today = getDayString(now);
    const state = this.spendingByWarrant.get(warrantId);
    const spentTodayMinorUnits = state && state.lastDate === today ? state.spentTodayMinorUnits : 0;
    const processed = this.processedTxnsByWarrant.get(warrantId) ?? new Set<TransactionId>();

    return {
      spentTodayMinorUnits,
      processedTransactionIds: new Set(processed),
    };
  }

  async recordAllowedTransaction(
    warrantId: WarrantId,
    transactionId: TransactionId,
    amountMinorUnits: number,
    now: Date = new Date(),
  ): Promise<SpendingState> {
    const today = getDayString(now);
    const state = this.spendingByWarrant.get(warrantId);
    const currentSpent = state && state.lastDate === today ? state.spentTodayMinorUnits : 0;
    const newSpent = currentSpent + amountMinorUnits;

    this.spendingByWarrant.set(warrantId, {
      spentTodayMinorUnits: newSpent,
      lastDate: today,
    });

    let processed = this.processedTxnsByWarrant.get(warrantId);
    if (!processed) {
      processed = new Set<TransactionId>();
      this.processedTxnsByWarrant.set(warrantId, processed);
    }
    processed.add(transactionId);

    return {
      spentTodayMinorUnits: newSpent,
      processedTransactionIds: new Set(processed),
    };
  }
}

export class PgSpendingRepository implements SpendingRepository {
  constructor(private readonly db: Database) {}

  async getSpendingState(warrantId: WarrantId, now: Date = new Date()): Promise<SpendingState> {
    const today = getDayString(now);

    // 1. Get spending state row
    const stateRows = await this.db
      .select()
      .from(spendingStateTable)
      .where(eq(spendingStateTable.warrantId, warrantId))
      .limit(1);

    let spentTodayMinorUnits = 0;
    const stateRow = stateRows[0];
    if (stateRow && stateRow.lastResetDate === today) {
      spentTodayMinorUnits = Number(stateRow.spentTodayMinorUnits);
    }

    // 2. Get all processed transaction IDs for this warrant
    const txRows = await this.db
      .select({ transactionId: transactionsTable.transactionId })
      .from(transactionsTable)
      .where(eq(transactionsTable.warrantId, warrantId));

    const processedTransactionIds = new Set<TransactionId>(
      txRows.map((r) => asTransactionId(r.transactionId)),
    );

    return {
      spentTodayMinorUnits,
      processedTransactionIds,
    };
  }

  async recordAllowedTransaction(
    warrantId: WarrantId,
    transactionId: TransactionId,
    amountMinorUnits: number,
    now: Date = new Date(),
  ): Promise<SpendingState> {
    const today = getDayString(now);

    const existingRows = await this.db
      .select()
      .from(spendingStateTable)
      .where(eq(spendingStateTable.warrantId, warrantId))
      .limit(1);

    let currentSpent = 0;
    const existing = existingRows[0];
    if (existing && existing.lastResetDate === today) {
      currentSpent = Number(existing.spentTodayMinorUnits);
    }

    const newSpent = currentSpent + amountMinorUnits;

    await this.db
      .insert(spendingStateTable)
      .values({
        warrantId,
        spentTodayMinorUnits: newSpent,
        lastResetDate: today,
        updatedAt: now.toISOString(),
      })
      .onConflictDoUpdate({
        target: spendingStateTable.warrantId,
        set: {
          spentTodayMinorUnits: newSpent,
          lastResetDate: today,
          updatedAt: now.toISOString(),
        },
      });

    return this.getSpendingState(warrantId, now);
  }
}
