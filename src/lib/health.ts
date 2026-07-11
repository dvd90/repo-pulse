import type { Config } from "../env.js";
import type { Logger } from "./log.js";
import type { HealthReport } from "./scoring/types.js";
import type { RepoRef } from "./repo.js";
import { fetchRepoSnapshot } from "./github/fetcher.js";
import { scoreSnapshot } from "./scoring/score.js";
import { HealthCache } from "./cache/kv.js";
import { AppError, isAppError } from "./errors.js";

export interface HealthServiceDeps {
  config: Config;
  log: Logger;
  /** Injectable clock (epoch millis) for deterministic tests. */
  now?: () => number;
  /** Injectable fetch for tests. */
  fetchImpl?: typeof fetch;
}

export interface HealthResult {
  report: HealthReport;
  /** True when served from cache (either fresh cache-hit or stale fallback). */
  fromCache: boolean;
}

/**
 * Produce a health report for a repository, applying the cache and resilience
 * policy:
 *
 * 1. Fresh cache hit → serve it (no GitHub call).
 * 2. Otherwise fetch from GitHub within the timeout budget, score, cache, serve.
 * 3. If GitHub is slow / rate-limited / erroring AND a stale cache entry exists,
 *    serve the stale copy with `stale: true` rather than failing.
 * 4. If there is nothing cached to fall back to, propagate the `AppError`.
 *
 * Scoring is deterministic: the snapshot's `asOf` drives all recency math.
 */
export async function getHealthReport(
  repo: RepoRef,
  deps: HealthServiceDeps,
): Promise<HealthResult> {
  const { config, log } = deps;
  const now = deps.now ?? (() => Date.now());
  const cache = new HealthCache(config.HEALTH_CACHE, {
    ttlSeconds: config.CACHE_TTL_SECONDS,
    log,
  });

  const cached = await cache.get(repo.full);
  const nowMs = now();

  if (cached && cache.isFresh(cached, nowMs)) {
    log.info("cache_hit", { repo: repo.full });
    return { report: cached.report, fromCache: true };
  }

  try {
    const snapshot = await fetchRepoSnapshot(repo, {
      token: config.GITHUB_TOKEN,
      timeoutMs: config.GITHUB_TIMEOUT_MS,
      log,
      asOf: new Date(nowMs).toISOString(),
      ...(deps.fetchImpl ? { fetchImpl: deps.fetchImpl } : {}),
    });
    const report = scoreSnapshot(snapshot);
    await cache.set(repo.full, report, nowMs);
    log.info("scored", { repo: repo.full, score: report.score, grade: report.grade });
    return { report, fromCache: false };
  } catch (err) {
    // Serve stale on transient upstream problems if we have anything cached.
    if (cached && isTransient(err)) {
      log.warn("serving_stale", {
        repo: repo.full,
        reason: isAppError(err) ? err.code : "unknown",
      });
      return { report: { ...cached.report, stale: true }, fromCache: true };
    }
    throw err;
  }
}

/** Transient upstream conditions that justify a stale-cache fallback. */
function isTransient(err: unknown): boolean {
  if (!isAppError(err)) return false;
  return (
    err.code === "upstream_timeout" ||
    err.code === "upstream_rate_limited" ||
    err.code === "upstream_error"
  );
}

/** Re-exported so route code can throw a typed missing-repo error if needed. */
export { AppError };
