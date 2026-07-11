import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { type AppError } from "./errors.js";

/**
 * Consistent response envelopes. Every JSON response — success or error — shares
 * a predictable shape so API consumers (and paying agents) can rely on it.
 *
 * Success: { ok: true, data, callId }
 * Error:   { ok: false, error: { code, message, ...details }, callId }
 */

export interface OkEnvelope<T> {
  ok: true;
  data: T;
  callId: string;
}

export interface ErrorEnvelope {
  ok: false;
  error: { code: string; message: string } & Record<string, unknown>;
  callId: string;
}

function callIdOf(c: Context): string {
  return c.get("callId") ?? "unknown";
}

/** 200 OK with a data payload. */
export function ok<T>(c: Context, data: T, status: ContentfulStatusCode = 200) {
  const body: OkEnvelope<T> = { ok: true, data, callId: callIdOf(c) };
  return c.json(body, status);
}

/** 201 Created with a data payload. */
export function created<T>(c: Context, data: T) {
  return ok(c, data, 201);
}

/** Error envelope built from an {@link AppError}. */
export function error(c: Context, err: AppError) {
  const body: ErrorEnvelope = {
    ok: false,
    error: { code: err.code, message: err.message, ...(err.details ?? {}) },
    callId: callIdOf(c),
  };
  return c.json(body, err.status as ContentfulStatusCode);
}
