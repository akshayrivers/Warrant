import type { AgentId, TransactionId, WarrantId } from "../domain/types.js";
import { type AuditEvent, type AuditEventType, computeEventHash } from "./events.js";

export interface AuditQueryFilter {
  readonly warrantId?: WarrantId | undefined;
  readonly transactionId?: TransactionId | undefined;
  readonly agentId?: AgentId | undefined;
  readonly eventType?: AuditEventType | undefined;
  readonly fromTimestamp?: string | undefined;
  readonly toTimestamp?: string | undefined;
  readonly limit?: number | undefined;
  readonly offset?: number | undefined;
}

export interface IntegrityCheckResult {
  readonly valid: boolean;
  readonly totalEvents: number;
  readonly compromisedEventId?: string | undefined;
  readonly reason?: string | undefined;
}

export interface AuditRepository {
  append(event: AuditEvent): Promise<AuditEvent>;
  query(filter?: AuditQueryFilter): Promise<readonly AuditEvent[]>;
  getLatestEvent(): Promise<AuditEvent | null>;
  getById(id: string): Promise<AuditEvent | null>;
  verifyIntegrity(): Promise<IntegrityCheckResult>;
}

/**
 * In-memory implementation of AuditRepository with cryptographic chain verification.
 */
export class InMemoryAuditRepository implements AuditRepository {
  private readonly events: AuditEvent[] = [];

  async append(event: AuditEvent): Promise<AuditEvent> {
    this.events.push(event);
    return event;
  }

  async query(filter?: AuditQueryFilter): Promise<readonly AuditEvent[]> {
    let result = [...this.events];

    if (filter?.warrantId) {
      result = result.filter((e) => e.warrantId === filter.warrantId);
    }
    if (filter?.transactionId) {
      result = result.filter((e) => e.transactionId === filter.transactionId);
    }
    if (filter?.agentId) {
      result = result.filter((e) => e.agentId === filter.agentId);
    }
    if (filter?.eventType) {
      result = result.filter((e) => e.eventType === filter.eventType);
    }
    if (filter?.fromTimestamp) {
      const fromTime = Date.parse(filter.fromTimestamp);
      result = result.filter((e) => Date.parse(e.timestamp) >= fromTime);
    }
    if (filter?.toTimestamp) {
      const toTime = Date.parse(filter.toTimestamp);
      result = result.filter((e) => Date.parse(e.timestamp) <= toTime);
    }

    const offset = filter?.offset ?? 0;
    const limit = filter?.limit ?? result.length;

    return result.slice(offset, offset + limit);
  }

  async getLatestEvent(): Promise<AuditEvent | null> {
    if (this.events.length === 0) return null;
    return this.events[this.events.length - 1] ?? null;
  }

  async getById(id: string): Promise<AuditEvent | null> {
    return this.events.find((e) => e.id === id) ?? null;
  }

  async verifyIntegrity(): Promise<IntegrityCheckResult> {
    if (this.events.length === 0) {
      return { valid: true, totalEvents: 0 };
    }

    let previousHash: string | null = null;

    for (let i = 0; i < this.events.length; i++) {
      const current = this.events[i]!;

      // 1. Check previous hash linkage
      if (current.previousEventHash !== previousHash) {
        return {
          valid: false,
          totalEvents: this.events.length,
          compromisedEventId: current.id,
          reason: `Broken chain link at index ${i}: expected previousHash '${previousHash}', got '${current.previousEventHash}'`,
        };
      }

      // 2. Recompute current event hash
      const { eventHash, ...withoutHash } = current;
      const expectedHash = computeEventHash(withoutHash);

      if (eventHash !== expectedHash) {
        return {
          valid: false,
          totalEvents: this.events.length,
          compromisedEventId: current.id,
          reason: `Hash mismatch at event ${current.id}: expected '${expectedHash}', stored '${eventHash}'`,
        };
      }

      previousHash = eventHash;
    }

    return { valid: true, totalEvents: this.events.length };
  }
}
