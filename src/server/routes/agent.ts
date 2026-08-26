import type { FastifyPluginAsync } from "fastify";
import { asWarrantId } from "../../domain/types.js";
import { getReasonDescription } from "../../policy/reasons.js";
import type { AppContext } from "../context.js";
import type { AgentAttackMode, ConversationTurn, PolicyFeedback } from "../../agent/agent.js";

const MAX_AGENT_ATTEMPTS = 3;

interface AgentRequestBody {
  userMessage: string;
  warrantId: string;
  history?: ConversationTurn[];
  simulateAttack?: AgentAttackMode;
}

export const agentRoutes = (context: AppContext): FastifyPluginAsync => {
  return async (fastify) => {
    // Conversational agent intent -> tool execution -> proposal formulation
    fastify.post<{ Body: AgentRequestBody }>("/api/agent/interact", async (request, reply) => {
      const { userMessage, warrantId, history, simulateAttack } = request.body;
      const warrant = await context.warrantRepo.getById(asWarrantId(warrantId));

      if (!warrant) {
        return reply.status(404).send({ error: `Warrant ${warrantId} not found` });
      }

      const spendingState = await context.spendingRepo.getSpendingState(warrant.payload.warrantId);
      const agentResult = await context.agentRunner.run({
        userMessage,
        warrant,
        ...(history ? { history } : {}),
        ...(simulateAttack ? { simulateAttack } : {}),
        spendingContext: {
          spentTodayMinorUnits: spendingState.spentTodayMinorUnits,
          remainingDailyMinorUnits: Math.max(
            0,
            warrant.payload.dailyLimit.minorUnits - spendingState.spentTodayMinorUnits,
          ),
        },
      });

      return reply.send(agentResult);
    });

    // Auto-Execute pipeline: Agent -> Proposal -> Validation -> Policy Engine -> Payment -> Audit.
    // On BLOCK, the deterministic decision reason is fed back to the agent so it
    // may revise its proposal. Every revision is re-evaluated by the policy
    // engine independently; the agent never gains authorization authority.
    fastify.post<{ Body: AgentRequestBody }>("/api/agent/auto-execute", async (request, reply) => {
      const { userMessage, warrantId, history, simulateAttack } = request.body;
      const warrant = await context.warrantRepo.getById(asWarrantId(warrantId));

      if (!warrant) {
        return reply.status(404).send({ error: `Warrant ${warrantId} not found` });
      }

      let policyFeedback: PolicyFeedback | undefined;
      const attempts: Array<{
        readonly attempt: number;
        readonly agentResult: Awaited<ReturnType<typeof context.agentRunner.run>>;
        readonly pipelineResult: unknown;
      }> = [];

      for (let attempt = 1; attempt <= MAX_AGENT_ATTEMPTS; attempt++) {
        const agentResult = await context.agentRunner.run({
          userMessage,
          warrant,
          ...(history ? { history } : {}),
          ...(policyFeedback ? { policyFeedback } : {}),
          // Adversarial injection is a demo switch: applied only to the first
          // proposal so revisions demonstrate legitimate proposer behavior.
          simulateAttack: attempt === 1 && simulateAttack ? simulateAttack : "NONE",
        });

        if (!agentResult.proposal) {
          attempts.push({ attempt, agentResult, pipelineResult: null });
          break;
        }

        const req = agentResult.proposal.request;
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
        attempts.push({ attempt, agentResult, pipelineResult });

        const decision = pipelineResult?.decision;
        if (!decision || decision.outcome === "ALLOW") break;

        const spendingState = await context.spendingRepo.getSpendingState(req.warrantId);
        policyFeedback = {
          attempt,
          reason: decision.reason,
          reasonDescription:
            pipelineResult?.proposalValidation?.valid === false
              ? String(pipelineResult.proposalValidation.reason)
              : getReasonDescription(decision.reason),
          blockedAmountMinorUnits: req.amount.minorUnits,
          remainingDailyMinorUnits: Math.max(
            0,
            warrant.payload.dailyLimit.minorUnits - spendingState.spentTodayMinorUnits,
          ),
        };
      }

      const last = attempts[attempts.length - 1];
      const finalOutcome =
        last && last.pipelineResult !== null && (last.pipelineResult as { decision?: { outcome?: string } })?.decision?.outcome === "ALLOW"
          ? "ALLOWED"
          : last?.pipelineResult !== null && last?.pipelineResult !== undefined
            ? "BLOCKED"
            : "NO_PROPOSAL";

      return reply.send({
        attempts,
        revised: attempts.length > 1,
        finalOutcome,
        // Backwards-compatible top-level fields for existing clients.
        agentResult: last?.agentResult,
        pipelineResult: last?.pipelineResult ?? null,
      });
    });
  };
};
