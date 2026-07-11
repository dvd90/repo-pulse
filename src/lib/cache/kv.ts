import type { HealthReport } from "../scoring/types.js";
import type { Logger } from "../log.js";

/**
 * Response cache backed by Workers KV. Key = `health:{owner}/{name}`. Stores the
 * full computed report plus the epoch millis it was cached, so we can serve a
 * *stale* copy (with a `stale` flag) when GitHub is slow or rate-limited.
 *
 * Freshness (`isFresh`, driven by `ttlSeconds`) is deliberately decoupled from
 * KV retention (`expirationTtl`). We retain each entry for the freshness window
 * PLUS a longer `STALE_RETENTION_SECONDS` grace, so a copy still exists in KV
 * after it stops being fresh — otherwise KV would hard-evict it at the exact
 * moment the stale-serve fallback needs it, making that fallback unreachable in
 * production.
 */

const KEY_PREFIX = "health:";

/**
 * How long past the freshness window a report is retained in KV so it can still
 * back a stale-serve when GitHub is unavailable. 24h is long enough to ride out
 * an extended outage while bounding staleness of the fallback.
 */
export const STALE_RETENTION_SECONDS = 24 * 60 * 60;

export interface CachedReport {
  report: HealthReport;
  /** Epoch millis when this entry was written. */
  cachedAt: number;
}

export interface HealthCacheOptions {
  ttlSeconds: number;
  log?: Logger | undefined;
}

export class HealthCache {
  constructor(
    private readonly kv: KVNamespace,
    private readonly opts: HealthCacheOptions,
  ) {}

  private key(repoFull: string): string {
    return `${KEY_PREFIX}${repoFull}`;
  }

  /** Read a cached report, or null on miss / parse failure. */
  async get(repoFull: string): Promise<CachedReport | null> {
    try {
      const raw = await this.kv.get(this.key(repoFull));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as CachedReport;
      if (!parsed?.report || typeof parsed.cachedAt !== "number") return null;
      return parsed;
    } catch (e) {
      this.opts.log?.warn("cache_get_failed", { repo: repoFull, error: msg(e) });
      return null;
    }
  }

  /**
   * Write a report with the configured TTL. `nowMs` is injectable for
   * deterministic tests. Cache failures are swallowed (best-effort).
   */
  async set(repoFull: string, report: HealthReport, nowMs: number): Promise<void> {
    try {
      const value: CachedReport = { report, cachedAt: nowMs };
      await this.kv.put(this.key(repoFull), JSON.stringify(value), {
        // Retain past the freshness window so the stale-serve fallback has
        // something to return. Freshness is enforced separately by isFresh().
        expirationTtl: Math.max(60, this.opts.ttlSeconds) + STALE_RETENTION_SECONDS,
      });
    } catch (e) {
      this.opts.log?.warn("cache_set_failed", { repo: repoFull, error: msg(e) });
    }
  }

  /** Whether a cached entry is still within the fresh TTL window. */
  isFresh(entry: CachedReport, nowMs: number): boolean {
    return nowMs - entry.cachedAt < this.opts.ttlSeconds * 1000;
  }
}

function msg(e: unknown): string {
  return e instanceof Error ? e.message : "unknown";
}
