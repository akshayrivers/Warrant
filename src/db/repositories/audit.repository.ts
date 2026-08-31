import { and, desc, eq, gte, lte } from "drizzle-orm";
import type {
  AuditEvent,
  AuditEventType,
} from "../../audit/events.js";
import { computeEventHash } from "../../audit/events.js";
import type {
  AuditQueryFilter,
  AuditRepository,
  IntegrityCheckResult,
} from "../../audit/repository.js";
import {
  asAgentId,
  asMerchantId,
  asTransactionId,
  asWarrantId,
} from "../../domain/types.js";
import type { Database } from "../client.js";
import { auditEventsTable } from "../schema/index.js";

function toIsoTimestamp(value: string): string {
  return new Date(value).toISOString();
}

export class PgAuditRepository implements AuditRepository {
  constructor(private readonly db: Database) {}

  async append(event: AuditEvent): Promise<AuditEvent> {
    await this.db.insert(auditEventsTable).values({
      id: event.id,
      timestamp: event.timestamp,
      eventType: event.eventType,
      warrantId: event.warrantId ?? null,
      transactionId: event.transactionId ?? null,
      agentId: event.agentId ?? null,
      merchantId: event.merchantId ?? null,
      details: event.details,
      previousEventHash: event.previousEventHash,
      eventHash: event.eventHash,
    });

    return event;
  }

  async query(filter?: AuditQueryFilter): Promise<readonly AuditEvent[]> {
    const conditions = [];

    if (filter?.warrantId) {
      conditions.push(eq(auditEventsTable.warrantId, filter.warrantId));
    }
    if (filter?.transactionId) {
      conditions.push(eq(auditEventsTable.transactionId, filter.transactionId));
    }
    if (filter?.agentId) {
      conditions.push(eq(auditEventsTable.agentId, filter.agentId));
    }
    if (filter?.eventType) {
      conditions.push(eq(auditEventsTable.eventType, filter.eventType));
    }
    if (filter?.fromTimestamp) {
      conditions.push(gte(auditEventsTable.timestamp, filter.fromTimestamp));
    }
    if (filter?.toTimestamp) {
      conditions.push(lte(auditEventsTable.timestamp, filter.toTimestamp));
    }

    let query = this.db.select().from(auditEventsTable);

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    const rows = await query
      .orderBy(desc(auditEventsTable.timestamp))
      .limit(filter?.limit ?? 100)
      .offset(filter?.offset ?? 0);

    return rows.map((row) => ({
      id: row.id,
      timestamp: toIsoTimestamp(row.timestamp),
      eventType: row.eventType as AuditEventType,
      warrantId: row.warrantId ? asWarrantId(row.warrantId) : undefined,
      transactionId: row.transactionId ? asTransactionId(row.transactionId) : undefined,
      agentId: row.agentId ? asAgentId(row.agentId) : undefined,
      merchantId: row.merchantId ? asMerchantId(row.merchantId) : undefined,
      details: row.details,
      previousEventHash: row.previousEventHash,
      eventHash: row.eventHash,
    }));
  }

  async getLatestEvent(): Promise<AuditEvent | null> {
    const rows = await this.db
      .select()
      .from(auditEventsTable)
      .orderBy(desc(auditEventsTable.timestamp))
      .limit(1);

    const row = rows[0];
    if (!row) return null;

    return {
      id: row.id,
      timestamp: toIsoTimestamp(row.timestamp),
      eventType: row.eventType as AuditEventType,
      warrantId: row.warrantId ? asWarrantId(row.warrantId) : undefined,
      transactionId: row.transactionId ? asTransactionId(row.transactionId) : undefined,
      agentId: row.agentId ? asAgentId(row.agentId) : undefined,
      merchantId: row.merchantId ? asMerchantId(row.merchantId) : undefined,
      details: row.details,
      previousEventHash: row.previousEventHash,
      eventHash: row.eventHash,
    };
  }

  async getById(id: string): Promise<AuditEvent | null> {
    const rows = await this.db
      .select()
      .from(auditEventsTable)
      .where(eq(auditEventsTable.id, id))
      .limit(1);

    const row = rows[0];
    if (!row) return null;

    return {
      id: row.id,
      timestamp: toIsoTimestamp(row.timestamp),
      eventType: row.eventType as AuditEventType,
      warrantId: row.warrantId ? asWarrantId(row.warrantId) : undefined,
      transactionId: row.transactionId ? asTransactionId(row.transactionId) : undefined,
      agentId: row.agentId ? asAgentId(row.agentId) : undefined,
      merchantId: row.merchantId ? asMerchantId(row.merchantId) : undefined,
      details: row.details,
      previousEventHash: row.previousEventHash,
      eventHash: row.eventHash,
    };
  }

  async verifyIntegrity(): Promise<IntegrityCheckResult> {
    const rows = await this.db
      .select()
      .from(auditEventsTable)
      .orderBy(auditEventsTable.timestamp, auditEventsTable.id);

    if (rows.length === 0) {
      return { valid: true, totalEvents: 0 };
    }

    let previousHash: string | null = null;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;

      if (row.previousEventHash !== previousHash) {
        return {
          valid: false,
          totalEvents: rows.length,
          compromisedEventId: row.id,
          reason: `Broken chain link at index ${i}`,
        };
      }

      const eventWithoutHash = {
        id: row.id,
        timestamp: toIsoTimestamp(row.timestamp),
        eventType: row.eventType as AuditEventType,
        warrantId: row.warrantId ? asWarrantId(row.warrantId) : undefined,
        transactionId: row.transactionId ? asTransactionId(row.transactionId) : undefined,
        agentId: row.agentId ? asAgentId(row.agentId) : undefined,
        merchantId: row.merchantId ? asMerchantId(row.merchantId) : undefined,
        details: row.details,
        previousEventHash: row.previousEventHash,
      };

      const expectedHash = computeEventHash(eventWithoutHash);

      if (row.eventHash !== expectedHash) {
        return {
          valid: false,
          totalEvents: rows.length,
          compromisedEventId: row.id,
          reason: `Hash mismatch at event ${row.id}`,
        };
      }

      previousHash = row.eventHash;
    }

    return { valid: true, totalEvents: rows.length };
  }
}
