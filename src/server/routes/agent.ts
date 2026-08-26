import type { FastifyPluginAsync } from "fastify";
import { asWarrantId } from "../../domain/types.js";
import type { AppContext } from "../context.js";

export const agentRoutes = (context: AppContext): FastifyPluginAsync => {
  return async (fastify) => {
    // Conversational agent intent -> tool execution -> proposal formulation
    fastify.post<{
      Body: {
        userMessage: string;
        warrantId: string;
        simulateAttack?: "NONE" | "PRICE_TAMPER" | "MERCHANT_SPOOF" | "CATEGORY_SPOOF" | "LIMIT_BYPASS";
      };
    }>("/api/agent/interact", async (request, reply) => {
      const { userMessage, warrantId, simulateAttack } = request.body;
      const warrant = await context.warrantRepo.getById(asWarrantId(warrantId));

      if (!warrant) {
        return reply.status(404).send({ error: `Warrant ${warrantId} not found` });
      }

      const agentResult = await context.agentRunner.run({
        userMessage,
        warrant,
        simulateAttack,
      });

      return reply.send(agentResult);
    });

    // Auto-Execute pipeline: Agent -> Proposal -> Validation -> Policy Engine -> Payment -> Audit
    fastify.post<{
      Body: {
        userMessage: string;
        warrantId: string;
        simulateAttack?: "NONE" | "PRICE_TAMPER" | "MERCHANT_SPOOF" | "CATEGORY_SPOOF" | "LIMIT_BYPASS";
      };
    }>("/api/agent/auto-execute", async (request, reply) => {
      const { userMessage, warrantId, simulateAttack } = request.body;
      const warrant = await context.warrantRepo.getById(asWarrantId(warrantId));

      if (!warrant) {
        return reply.status(404).send({ error: `Warrant ${warrantId} not found` });
      }

      // 1. Agent runs tools & formulates proposal
      const agentResult = await context.agentRunner.run({
        userMessage,
        warrant,
        simulateAttack,
      });

      if (!agentResult.proposal) {
        return reply.send({
          agentResult,
          pipelineResult: null,
          message: "Agent did not formulate a transaction proposal.",
        });
      }

      const req = agentResult.proposal.request;

      // 2. Dispatch to the execution endpoint internally
      const executeResponse = await fastify.inject({
        method: "POST",
        url: "/api/transactions/execute",
        payload: {
          warrantId: req.warrantId,
          transactionId: req.transactionId,
          agentId: req.agentId,
          merchantId: req.merchantId,
          category: req.category,
          sku: req.sku,
          amountMinorUnits: req.amount.minorUnits,
          currency: req.amount.currency,
          signedWarrant: warrant,
        },
      });

      const pipelineResult = JSON.parse(executeResponse.body);

      return reply.send({
        agentResult,
        pipelineResult,
      });
    });
  };
};
