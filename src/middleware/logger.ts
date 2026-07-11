import { createMiddleware } from "hono/factory";
import { createLogger } from "../lib/log.js";
import type { AppEnv } from "../types.js";

/**
 * Attach a callId-bound logger to the context and log request start/finish with
 * method, path, status, and duration. Runs after the callId middleware.
 */
export const requestLogger = createMiddleware<AppEnv>(async (c, next) => {
  const log = createLogger(c.get("callId"));
  c.set("log", log);
  const start = Date.now();
  await next();
  log.info("request", {
    method: c.req.method,
    path: new URL(c.req.url).pathname,
    status: c.res.status,
    durationMs: Date.now() - start,
  });
});
