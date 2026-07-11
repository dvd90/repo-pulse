import { Hono } from "hono";
import { parseEnv } from "../env.js";
import { parseRepo } from "../lib/repo.js";
import { getHealthReport } from "../lib/health.js";
import { ok } from "../lib/response.js";
import type { AppEnv } from "../types.js";

/**
 * Core health endpoint. In production the x402 payment middleware (M2) runs in
 * front of this route; the handler itself is payment-agnostic and simply
 * computes (or serves cached) the deterministic health report.
 */
export const healthRoutes = new Hono<AppEnv>();

healthRoutes.get("/v1/health", async (c) => {
  const config = parseEnv(c.env);
  const repo = parseRepo(c.req.query("repo"));
  const log = c.get("log");

  const githubFetch = c.get("githubFetch");
  const { report } = await getHealthReport(repo, {
    config,
    log,
    ...(githubFetch ? { fetchImpl: githubFetch } : {}),
  });

  // Cache-Control mirrors the KV TTL so intermediaries can cache paid responses
  // the client already holds.
  c.header("Cache-Control", `public, max-age=${config.CACHE_TTL_SECONDS}`);
  return ok(c, report);
});
