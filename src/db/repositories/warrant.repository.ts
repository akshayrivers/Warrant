import { eq } from "drizzle-orm";
import type {
  CurrencyCode,
  SignedWarrant,
  WarrantId,
  WarrantPayload,
} from "../../domain/types.js";
import { asAgentId, asMerchantId, asWarrantId } from "../../domain/types.js";
import type { Database } from "../client.js";
import { warrantsTable } from "../schema/index.js";

export interface WarrantRepository {
  save(warrant: SignedWarrant): Promise<SignedWarrant>;
  getById(id: WarrantId): Promise<SignedWarrant | null>;
  list(): Promise<readonly SignedWarrant[]>;
}

// PostgreSQL returns timestamptz in its own textual format
// ("2026-08-26 12:33:06.567+00"), which does not match the ISO string that was
// signed at issuance — silently breaking HMAC verification of every persisted
// warrant. The repository boundary owns normalizing timestamps back to the
// exact ISO representation that was signed.
function toIsoTimestamp(value: string): string {
  return new Date(value).toISOString();
}

export class InMemoryWarrantRepository implements WarrantRepository {
  private readonly warrants = new Map<WarrantId, SignedWarrant>();

  async save(warrant: SignedWarrant): Promise<SignedWarrant> {
    this.warrants.set(warrant.payload.warrantId, warrant);
    return warrant;
  }

  async getById(id: WarrantId): Promise<SignedWarrant | null> {
    return this.warrants.get(id) ?? null;
  }

  async list(): Promise<readonly SignedWarrant[]> {
    return Array.from(this.warrants.values());
  }
}

export class PgWarrantRepository implements WarrantRepository {
  constructor(private readonly db: Database) {}

  async save(warrant: SignedWarrant): Promise<SignedWarrant> {
    const { payload, signature } = warrant;
    const merchantsArray = Array.from(payload.allowedMerchants) as string[];
    const categoriesArray = Array.from(payload.allowedCategories) as string[];

    await this.db
      .insert(warrantsTable)
      .values({
        warrantId: payload.warrantId,
        principal: payload.principal,
        agentId: payload.agentId,
        allowedMerchants: merchantsArray,
        allowedCategories: categoriesArray,
        perTransactionLimitMinorUnits: payload.perTransactionLimit.minorUnits,
        dailyLimitMinorUnits: payload.dailyLimit.minorUnits,
        currency: payload.perTransactionLimit.currency,
        issuedAt: payload.issuedAt,
        expiresAt: payload.expiresAt,
        signature,
      })
      .onConflictDoUpdate({
        target: warrantsTable.warrantId,
        set: {
          principal: payload.principal,
          agentId: payload.agentId,
          allowedMerchants: merchantsArray,
          allowedCategories: categoriesArray,
          perTransactionLimitMinorUnits: payload.perTransactionLimit.minorUnits,
          dailyLimitMinorUnits: payload.dailyLimit.minorUnits,
          currency: payload.perTransactionLimit.currency,
          issuedAt: payload.issuedAt,
          expiresAt: payload.expiresAt,
          signature,
        },
      });

    return warrant;
  }

  async getById(id: WarrantId): Promise<SignedWarrant | null> {
    const rows = await this.db
      .select()
      .from(warrantsTable)
      .where(eq(warrantsTable.warrantId, id))
      .limit(1);

    const row = rows[0];
    if (!row) return null;

    const payload: WarrantPayload = {
      warrantId: asWarrantId(row.warrantId),
      principal: row.principal,
      agentId: asAgentId(row.agentId),
      allowedMerchants: row.allowedMerchants.map((m) => asMerchantId(m)),
      allowedCategories: row.allowedCategories,
      perTransactionLimit: {
        minorUnits: Number(row.perTransactionLimitMinorUnits),
        currency: row.currency as CurrencyCode,
      },
      dailyLimit: {
        minorUnits: Number(row.dailyLimitMinorUnits),
        currency: row.currency as CurrencyCode,
      },
      issuedAt: toIsoTimestamp(row.issuedAt),
      expiresAt: toIsoTimestamp(row.expiresAt),
    };

    return {
      payload,
      signature: row.signature,
    };
  }

  async list(): Promise<readonly SignedWarrant[]> {
    const rows = await this.db.select().from(warrantsTable);
    return rows.map((row) => ({
      payload: {
        warrantId: asWarrantId(row.warrantId),
        principal: row.principal,
        agentId: asAgentId(row.agentId),
        allowedMerchants: row.allowedMerchants.map((m) => asMerchantId(m)),
        allowedCategories: row.allowedCategories,
        perTransactionLimit: {
          minorUnits: Number(row.perTransactionLimitMinorUnits),
          currency: row.currency as CurrencyCode,
        },
        dailyLimit: {
          minorUnits: Number(row.dailyLimitMinorUnits),
          currency: row.currency as CurrencyCode,
        },
        issuedAt: toIsoTimestamp(row.issuedAt),
        expiresAt: toIsoTimestamp(row.expiresAt),
      },
      signature: row.signature,
    }));
  }
}
