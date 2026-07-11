import { Hono, type MiddlewareHandler } from "hono";
import { callId } from "./middleware/callId.js";
import { requestLogger } from "./middleware/logger.js";
import { onError, onNotFound } from "./lib/errorHandler.js";
import { systemRoutes } from "./routes/system.js";
import { schemaRoutes } from "./routes/schema.js";
import { healthRoutes } from "./routes/health.js";
import { parseEnv } from "./env.js";
import { buildPaymentMiddleware } from "./lib/x402/middleware.js";
import type { FacilitatorClient } from "@x402/core/server";
import type { AppEnv } from "./types.js";

export interface CreateAppOptions {
  /**
   * Inject a facilitator client for the x402 payment gate (tests supply a fake).
   * In production this is omitted and the CDP/HTTP facilitator is used.
   */
  facilitatorClient?: FacilitatorClient;
  /** Sync supported kinds from the facilitator on first request (default true). */
  syncFacilitatorOnStart?: boolean;
  /** Inject the fetch used by the GitHub fetcher (tests mock the GitHub API). */
  githubFetch?: typeof fetch;
}

/**
 * Build the Hono application. Factored out of the Worker entrypoint so tests can
 * instantiate the same app. Middleware order: callId → logger → (payment gate on
 * /v1/health) → routes, with a central error handler and 404.
 */
export function createApp(options: CreateAppOptions = {}): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.use("*", callId);
  app.use("*", requestLogger);

  if (options.githubFetch) {
    const gh = options.githubFetch;
    app.use("*", async (c, next) => {
      c.set("githubFetch", gh);
      await next();
    });
  }

  // x402 payment gate on the paid endpoint only. Env is per-request in Workers,
  // so we build the payment middleware lazily on first request and memoize it
  // for the isolate.
  let paymentMw: MiddlewareHandler | null = null;
  app.use("/v1/health", async (c, next) => {
    if (!paymentMw) {
      const config = parseEnv(c.env);
      paymentMw = buildPaymentMiddleware(config, {
        log: c.get("log"),
        ...(options.facilitatorClient ? { facilitatorClient: options.facilitatorClient } : {}),
        ...(options.syncFacilitatorOnStart !== undefined
          ? { syncFacilitatorOnStart: options.syncFacilitatorOnStart }
          : {}),
      });
    }
    return paymentMw(c, next);
  });

  app.route("/", systemRoutes);
  app.route("/", schemaRoutes);
  app.route("/", healthRoutes);

  app.notFound(onNotFound);
  app.onError(onError);

  return app;
}
