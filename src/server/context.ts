import "dotenv/config";
import { type AuditRepository, InMemoryAuditRepository } from "../audit/repository.js";
import { AuditService } from "../audit/service.js";
import { getDb } from "../db/client.js";
import {
  InMemorySpendingRepository,
  InMemoryTransactionRepository,
  InMemoryWarrantRepository,
  PgAuditRepository,
  PgSpendingRepository,
  PgTransactionRepository,
  PgWarrantRepository,
  type SpendingRepository,
  type TransactionRepository,
  type WarrantRepository,
} from "../db/repositories/index.js";
import { createPaymentGateway } from "../payments/razorpay.js";
import { PaymentService } from "../payments/service.js";
import type { PaymentGateway } from "../payments/types.js";
import { AgentRunner } from "../agent/agent.js";

export interface AppContext {
  readonly warrantRepo: WarrantRepository;
  readonly spendingRepo: SpendingRepository;
  readonly transactionRepo: TransactionRepository;
  readonly auditRepo: AuditRepository;
  readonly auditService: AuditService;
  readonly paymentGateway: PaymentGateway;
  readonly paymentService: PaymentService;
  readonly agentRunner: AgentRunner;
  readonly secret: string;
}

export interface CreateAppContextOptions extends Partial<AppContext> {
  readonly forceInMemory?: boolean;
}

export function createAppContext(overrides?: CreateAppContextOptions): AppContext {
  const isTest = process.env["NODE_ENV"] === "test" || overrides?.forceInMemory;
  const secret = overrides?.secret ?? process.env["WARRANT_SECRET"] ?? "default-warrant-dev-secret-key";
  const db = !isTest ? getDb() : null;

  let warrantRepo = overrides?.warrantRepo;
  let spendingRepo = overrides?.spendingRepo;
  let transactionRepo = overrides?.transactionRepo;
  let auditRepo = overrides?.auditRepo;

  if (!warrantRepo) {
    warrantRepo = db ? new PgWarrantRepository(db) : new InMemoryWarrantRepository();
  }
  if (!spendingRepo) {
    spendingRepo = db ? new PgSpendingRepository(db) : new InMemorySpendingRepository();
  }
  if (!transactionRepo) {
    transactionRepo = db ? new PgTransactionRepository(db) : new InMemoryTransactionRepository();
  }
  if (!auditRepo) {
    auditRepo = db ? new PgAuditRepository(db) : new InMemoryAuditRepository();
  }

  const auditService = overrides?.auditService ?? new AuditService(auditRepo);
  const paymentGateway = overrides?.paymentGateway ?? createPaymentGateway({ forceTestSimulator: isTest });
  const paymentService = overrides?.paymentService ?? new PaymentService(paymentGateway, auditService);
  const agentRunner = overrides?.agentRunner ?? new AgentRunner();

  return {
    warrantRepo,
    spendingRepo,
    transactionRepo,
    auditRepo,
    auditService,
    paymentGateway,
    paymentService,
    agentRunner,
    secret,
  };
}
