import type { FastifyPluginAsync } from "fastify";
import type { Category } from "../../catalog/types.js";
import { validateProposal } from "../../catalog/validate.js";
import {
  asAgentId,
  asMerchantId,
  asTransactionId,
  asWarrantId,
  type CurrencyCode,
  type SignedWarrant,
  type TransactionRequest,
} from "../../domain/types.js";
import { evaluate } from "../../policy/engine.js";
import type { AppContext } from "../context.js";

export const transactionRoutes = (context: AppContext): FastifyPluginAsync => {
  return async (fastify) => {
    // Validate proposal against catalog only (no authorization)
    fastify.post<{
      Body: {
        merchantId: string;
        sku: string;
        category: Category;
        amountMinorUnits: number;
      };
    }>("/api/proposals/validate", async (request, reply) => {
      const { body } = request;
      const validation = validateProposal({
        merchantId: asMerchantId(body.merchantId),
        sku: body.sku,
        category: body.category,
        amountMinorUnits: body.amountMinorUnits,
      });

      return reply.send(validation);
    });

    // Full Pipeline: Proposal Validation -> Policy Evaluation -> Payment Execution -> Audit Trail
    fastify.post<{
      Body: {
        warrantId: string;
        transactionId?: string;
        agentId: string;
        merchantId: string;
        category: Category;
        sku: string;
        amountMinorUnits: number;
        currency?: CurrencyCode;
        signedWarrant?: SignedWarrant;
      };
    }>("/api/transactions/execute", async (request, reply) => {
      const { body } = request;
      const transactionId = asTransactionId(body.transactionId ?? `txn_${Date.now()}_${Math.floor(Math.random() * 1000)}`);
      const warrantId = asWarrantId(body.warrantId);
      const agentId = asAgentId(body.agentId);
      const merchantId = asMerchantId(body.merchantId);
      const currency: CurrencyCode = body.currency ?? "INR";
      const requestedAt = new Date().toISOString();

      // Step 1: Retrieve Signed Warrant
      let warrant = body.signedWarrant;
      if (!warrant) {
        const found = await context.warrantRepo.getById(warrantId);
        if (!found) {
          return reply.status(404).send({
            error: `Warrant ${warrantId} not found`,
            transactionId,
          });
        }
        warrant = found;
      }

      // Step 2: Audit log proposal received
      await context.auditService.logProposalReceived({
        transactionId,
        warrantId,
        agentId,
        merchantId,
        sku: body.sku,
        category: body.category,
        amountMinorUnits: body.amountMinorUnits,
      });

      // Step 3: Proposal Validation (Catalog / Price / SKU check)
      const proposalValidation = validateProposal({
        merchantId,
        sku: body.sku,
        category: body.category,
        amountMinorUnits: body.amountMinorUnits,
      });

      await context.auditService.logProposalValidated({
        transactionId,
        valid: proposalValidation.valid,
        reason: proposalValidation.valid ? undefined : proposalValidation.reason,
        sku: body.sku,
        priceMinorUnits: proposalValidation.valid ? proposalValidation.product.priceMinorUnits : undefined,
      });

      if (!proposalValidation.valid) {
        // Record as blocked transaction due to invalid proposal
        await context.transactionRepo.save({
          transactionId,
          warrantId,
          agentId,
          merchantId,
          category: body.category,
          sku: body.sku,
          amountMinorUnits: body.amountMinorUnits,
          currency,
          outcome: "BLOCK",
          reason: `PROPOSAL_INVALID_${proposalValidation.reason}`,
          requestedAt,
          processedAt: new Date().toISOString(),
        });

        return reply.status(200).send({
          success: false,
          stage: "PROPOSAL_VALIDATION",
          proposalValidation,
          decision: {
            outcome: "BLOCK",
            reason: proposalValidation.reason,
            transactionId,
            warrantId,
            evaluatedAt: new Date().toISOString(),
          },
          payment: null,
        });
      }

      // Step 4: Retrieve Spending State
      const spending = await context.spendingRepo.getSpendingState(warrantId);

      const txnRequest: TransactionRequest = {
        transactionId,
        warrantId,
        agentId,
        merchantId,
        category: body.category,
        sku: body.sku,
        amount: {
          minorUnits: body.amountMinorUnits,
          currency,
        },
        requestedAt,
      };

      // Step 5: Policy Engine Evaluation
      const decision = evaluate({
        request: txnRequest,
        warrant,
        spending,
        secret: context.secret,
      });

      // Step 6: Audit log policy evaluation
      await context.auditService.logPolicyEvaluated({
        transactionId,
        warrantId,
        outcome: decision.outcome,
        reason: decision.reason,
        spentTodayMinorUnits: spending.spentTodayMinorUnits,
        dailyLimitMinorUnits: warrant.payload.dailyLimit.minorUnits,
        perTransactionLimitMinorUnits: warrant.payload.perTransactionLimit.minorUnits,
      });

      if (decision.outcome === "BLOCK") {
        await context.transactionRepo.save({
          transactionId,
          warrantId,
          agentId,
          merchantId,
          category: body.category,
          sku: body.sku,
          amountMinorUnits: body.amountMinorUnits,
          currency,
          outcome: "BLOCK",
          reason: decision.reason,
          requestedAt,
          processedAt: new Date().toISOString(),
        });

        return reply.status(200).send({
          success: false,
          stage: "POLICY_EVALUATION",
          proposalValidation,
          decision,
          payment: null,
        });
      }

      // Step 7: ALLOWED -> Update spending state & Execute Payment
      await context.spendingRepo.recordAllowedTransaction(
        warrantId,
        transactionId,
        body.amountMinorUnits,
      );

      const paymentResult = await context.paymentService.processPayment({
        transactionId,
        warrantId,
        merchantId,
        amount: {
          minorUnits: body.amountMinorUnits,
          currency,
        },
      });

      await context.transactionRepo.save({
        transactionId,
        warrantId,
        agentId,
        merchantId,
        category: body.category,
        sku: body.sku,
        amountMinorUnits: body.amountMinorUnits,
        currency,
        outcome: "ALLOW",
        reason: decision.reason,
        paymentId: paymentResult.paymentId,
        paymentStatus: paymentResult.status,
        requestedAt,
        processedAt: new Date().toISOString(),
      });

      return reply.status(200).send({
        success: paymentResult.status === "SUCCESS",
        stage: "COMPLETED",
        proposalValidation,
        decision,
        payment: paymentResult,
      });
    });

    // List all transactions
    fastify.get<{ Querystring: { warrantId?: string } }>(
      "/api/transactions",
      async (request, reply) => {
        const warrantId = request.query.warrantId ? asWarrantId(request.query.warrantId) : undefined;
        const transactions = await context.transactionRepo.list(warrantId ? { warrantId } : undefined);
        return reply.send({ transactions });
      },
    );

    // Get transaction by ID
    fastify.get<{ Params: { transactionId: string } }>(
      "/api/transactions/:transactionId",
      async (request, reply) => {
        const tx = await context.transactionRepo.getById(asTransactionId(request.params.transactionId));
        if (!tx) {
          return reply.status(404).send({ error: `Transaction ${request.params.transactionId} not found` });
        }
        return reply.send(tx);
      },
    );
  };
};
