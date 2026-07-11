import type { HealthReport } from "../scoring/types.js";
import type { Logger } from "../log.js";

/**
 * Response cache backed by Workers KV. Key = `health:{owner}/{name}`. Stores the
 * full computed report plus the epoch millis it was cached, so we can serve a
 * *stale* copy (with a `stale` flag) when GitHub is slow or rate-limited.
 *
 * KV's own `expirationTtl` performs hard eviction; we keep the cached-at time in
 * the value to support the soft/stale-serve behavior independently.
 */

const KEY_PREFIX = "health:";

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
        expirationTtl: Math.max(60, this.opts.ttlSeconds),
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
