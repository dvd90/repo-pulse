import { Hono } from "hono";
import { parseEnv } from "../env.js";
import { ok } from "../lib/response.js";
import type { AppEnv } from "../types.js";

/**
 * Liveness and readiness endpoints (both free).
 * - /healthz: process is up. No external checks.
 * - /readyz: config valid + KV binding reachable + facilitator reachable.
 */
export const systemRoutes = new Hono<AppEnv>();

systemRoutes.get("/healthz", (c) => ok(c, { status: "ok", service: "repo-pulse" }));

systemRoutes.get("/readyz", async (c) => {
  const checks: Record<string, { ok: boolean; detail?: string }> = {};

  // Config validation
  let config;
  try {
    config = parseEnv(c.env);
    checks.config = { ok: true };
  } catch (e) {
    checks.config = { ok: false, detail: e instanceof Error ? e.message : "invalid" };
  }

  // KV binding reachability — a read of a sentinel key should not throw.
  try {
    await c.env.HEALTH_CACHE.get("__readyz__");
    checks.kv = { ok: true };
  } catch (e) {
    checks.kv = { ok: false, detail: e instanceof Error ? e.message : "unreachable" };
  }

  // Facilitator reachability — best-effort HEAD/GET, short timeout. We don't
  // require a 200 (auth may be needed), only that the host answers.
  if (config) {
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(config.X402_FACILITATOR_URL, {
        method: "GET",
        signal: controller.signal,
      });
      clearTimeout(t);
      checks.facilitator = { ok: true, detail: `status ${res.status}` };
    } catch (e) {
      checks.facilitator = { ok: false, detail: e instanceof Error ? e.message : "unreachable" };
    }
  } else {
    checks.facilitator = { ok: false, detail: "skipped: config invalid" };
  }

  const ready = Object.values(checks).every((c2) => c2.ok);
  // Build the envelope directly so its `ok` flag reflects readiness rather than
  // always claiming success — a 503 must not carry `ok: true`.
  return c.json({ ok: ready, data: { ready, checks }, callId: c.get("callId") }, ready ? 200 : 503);
});
