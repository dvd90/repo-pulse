import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { AppError, isAppError } from "./errors.js";
import { error as errorResponse } from "./response.js";
import type { Logger } from "./log.js";

/**
 * Central Hono `onError` handler. Every error funnels here and is mapped to the
 * consistent error envelope. Handlers never juggle status codes themselves —
 * they throw `AppError` (or an `HTTPException`) and this decides the response.
 */
export function onError(err: Error, c: Context): Response {
  const log = (c.get("log") as Logger | undefined) ?? undefined;

  if (isAppError(err)) {
    // 5xx are unexpected; log at error level. 4xx are client faults; info.
    const level = err.status >= 500 ? "error" : "info";
    log?.[level]("app_error", { code: err.code, status: err.status, message: err.message });
    return errorResponse(c, err);
  }

  if (err instanceof HTTPException) {
    const mapped = new AppError(
      err.status === 404 ? "not_found" : "internal_error",
      err.message || "Request failed",
      err.status,
    );
    log?.warn("http_exception", { status: err.status, message: err.message });
    return errorResponse(c, mapped);
  }

  // Unknown/unexpected error — never leak internals.
  log?.error("unhandled_error", { message: err.message, stack: err.stack });
  return errorResponse(c, new AppError("internal_error", "Internal server error", 500));
}

/** Central 404 handler for unmatched routes. */
export function onNotFound(c: Context): Response {
  return errorResponse(
    c,
    new AppError("not_found", `No route for ${c.req.method} ${new URL(c.req.url).pathname}`, 404),
  );
}
