import cors from "@fastify/cors";
import fastify, { type FastifyInstance } from "fastify";
import { type AppContext, createAppContext } from "./context.js";
import { agentRoutes } from "./routes/agent.js";
import { auditRoutes } from "./routes/audit.js";
import { catalogRoutes } from "./routes/catalog.js";
import { transactionRoutes } from "./routes/transactions.js";
import { warrantRoutes } from "./routes/warrants.js";

import { registerErrorHandler } from "./plugins/error-handler.js";

export function buildApp(customContext?: AppContext): FastifyInstance {
  const app = fastify({
    logger: false, // Clean testing output; can be enabled via options if needed
  });

  const context = customContext ?? createAppContext();

  // Register error handler
  registerErrorHandler(app);

  // Register CORS
  app.register(cors, {
    origin: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  });

  // Healthcheck endpoint
  app.get("/health", async () => {
    return { status: "ok", service: "warrant-backend", timestamp: new Date().toISOString() };
  });

  // Register routes
  app.register(warrantRoutes(context));
  app.register(catalogRoutes(context));
  app.register(transactionRoutes(context));
  app.register(auditRoutes(context));
  app.register(agentRoutes(context));

  return app;
}
