import type { FastifyPluginAsync } from "fastify";
import { catalogs, getCatalog, getMerchant, getProduct } from "../../catalog/catalog.js";
import { asMerchantId } from "../../domain/types.js";
import type { AppContext } from "../context.js";

export const catalogRoutes = (_context: AppContext): FastifyPluginAsync => {
  return async (fastify) => {
    // Get full catalog
    fastify.get("/api/catalog", async (_request, reply) => {
      return reply.send({ catalogs });
    });

    // List merchants
    fastify.get("/api/catalog/merchants", async (_request, reply) => {
      const merchants = catalogs.map((c) => c.merchant);
      return reply.send({ merchants });
    });

    // Get specific merchant catalog
    fastify.get<{ Params: { merchantId: string } }>(
      "/api/catalog/merchants/:merchantId",
      async (request, reply) => {
        const merchantId = asMerchantId(request.params.merchantId);
        const catalog = getCatalog(merchantId);
        if (!catalog) {
          return reply.status(404).send({ error: `Merchant ${merchantId} not found` });
        }
        return reply.send(catalog);
      },
    );

    // List all products across all merchants
    fastify.get("/api/catalog/products", async (_request, reply) => {
      const products = catalogs.flatMap((c) => c.products);
      return reply.send({ products });
    });

    // Get single product by SKU
    fastify.get<{ Params: { sku: string } }>(
      "/api/catalog/products/:sku",
      async (request, reply) => {
        const product = getProduct(request.params.sku);
        if (!product) {
          return reply.status(404).send({ error: `Product SKU ${request.params.sku} not found` });
        }
        return reply.send(product);
      },
    );
  };
};
