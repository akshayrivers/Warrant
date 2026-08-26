import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { WarrantError } from "../../domain/errors.js";

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError | Error, _request: FastifyRequest, reply: FastifyReply) => {
    if (error instanceof WarrantError) {
      return reply.status(400).send({
        error: error.name,
        code: error.code,
        message: error.message,
      });
    }

    const statusCode = (error as FastifyError).statusCode ?? 500;
    return reply.status(statusCode).send({
      error: error.name || "InternalServerError",
      message: error.message || "An unexpected error occurred",
    });
  });
}
