import type { FastifyPluginAsync } from "fastify";
import type { AuditEventType } from "../../audit/events.js";
import { asAgentId, asTransactionId, asWarrantId } from "../../domain/types.js";
import type { AppContext } from "../context.js";

export const auditRoutes = (context: AppContext): FastifyPluginAsync => {
  return async (fastify) => {
    // Query audit trail with filters
    fastify.get<{
      Querystring: {
        warrantId?: string;
        transactionId?: string;
        agentId?: string;
        eventType?: string;
        limit?: number;
        offset?: number;
      };
    }>("/api/audit", async (request, reply) => {
      const { query } = request;
      const events = await context.auditService.query({
        warrantId: query.warrantId ? asWarrantId(query.warrantId) : undefined,
        transactionId: query.transactionId ? asTransactionId(query.transactionId) : undefined,
        agentId: query.agentId ? asAgentId(query.agentId) : undefined,
        eventType: query.eventType ? (query.eventType as AuditEventType) : undefined,
        limit: query.limit ? Number(query.limit) : undefined,
        offset: query.offset ? Number(query.offset) : undefined,
      });

      return reply.send({ events });
    });

    // Check cryptographic hash chain integrity
    fastify.get("/api/audit/integrity", async (_request, reply) => {
      const integrity = await context.auditService.verifyIntegrity();
      return reply.send(integrity);
    });
  };
};
