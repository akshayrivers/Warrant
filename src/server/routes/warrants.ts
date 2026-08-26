import type { FastifyPluginAsync } from "fastify";
import {
  asAgentId,
  asMerchantId,
  asWarrantId,
  type CurrencyCode,
  type WarrantId,
  type WarrantPayload,
} from "../../domain/types.js";
import { signWarrant } from "../../warrant/sign.js";
import type { AppContext } from "../context.js";

export const warrantRoutes = (context: AppContext): FastifyPluginAsync => {
  return async (fastify) => {
    // Issue and sign a new warrant
    fastify.post<{
      Body: {
        warrantId?: string;
        principal: string;
        agentId: string;
        allowedMerchants: string[];
        allowedCategories: string[];
        perTransactionLimitMinorUnits: number;
        dailyLimitMinorUnits: number;
        currency?: CurrencyCode;
        expiresAt: string;
      };
    }>("/api/warrants", async (request, reply) => {
      const { body } = request;
      const warrantId = asWarrantId(body.warrantId ?? `warrant_${Date.now()}`);
      const currency: CurrencyCode = body.currency ?? "INR";
      const issuedAt = new Date().toISOString();

      const payload: WarrantPayload = {
        warrantId,
        principal: body.principal,
        agentId: asAgentId(body.agentId),
        allowedMerchants: body.allowedMerchants.map(asMerchantId),
        allowedCategories: body.allowedCategories,
        perTransactionLimit: {
          minorUnits: body.perTransactionLimitMinorUnits,
          currency,
        },
        dailyLimit: {
          minorUnits: body.dailyLimitMinorUnits,
          currency,
        },
        issuedAt,
        expiresAt: body.expiresAt,
      };

      const signedWarrant = signWarrant(payload, context.secret);
      await context.warrantRepo.save(signedWarrant);

      await context.auditService.logWarrantIssued({
        warrantId,
        principal: body.principal,
        agentId: payload.agentId,
        perTransactionLimitMinorUnits: body.perTransactionLimitMinorUnits,
        dailyLimitMinorUnits: body.dailyLimitMinorUnits,
        expiresAt: body.expiresAt,
      });

      return reply.status(201).send(signedWarrant);
    });

    // List all warrants
    fastify.get("/api/warrants", async (_request, reply) => {
      const warrants = await context.warrantRepo.list();
      return reply.send({ warrants });
    });

    // Get warrant by ID with current spending state
    fastify.get<{ Params: { warrantId: string } }>(
      "/api/warrants/:warrantId",
      async (request, reply) => {
        const warrantId = asWarrantId(request.params.warrantId);
        const warrant = await context.warrantRepo.getById(warrantId);

        if (!warrant) {
          return reply.status(404).send({ error: `Warrant ${warrantId} not found` });
        }

        const spendingState = await context.spendingRepo.getSpendingState(warrantId);
        const remainingDailyMinorUnits = Math.max(
          0,
          warrant.payload.dailyLimit.minorUnits - spendingState.spentTodayMinorUnits,
        );

        return reply.send({
          warrant,
          spending: {
            spentTodayMinorUnits: spendingState.spentTodayMinorUnits,
            remainingDailyMinorUnits,
            processedTransactionsCount: spendingState.processedTransactionIds.size,
          },
        });
      },
    );
  };
};
