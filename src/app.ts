import { Hono } from "hono";
import { callId } from "./middleware/callId.js";
import { requestLogger } from "./middleware/logger.js";
import { onError, onNotFound } from "./lib/errorHandler.js";
import { systemRoutes } from "./routes/system.js";
import { schemaRoutes } from "./routes/schema.js";
import type { AppEnv } from "./types.js";

/**
 * Build the Hono application. Factored out of the Worker entrypoint so tests can
 * instantiate the same app. Middleware order: callId → logger → routes, with a
 * central error handler and 404.
 */
export function createApp(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.use("*", callId);
  app.use("*", requestLogger);

  app.route("/", systemRoutes);
  app.route("/", schemaRoutes);

  app.notFound(onNotFound);
  app.onError(onError);

  return app;
}
