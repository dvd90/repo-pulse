import { describe, it, expect } from "vitest";
import { HealthCache, STALE_RETENTION_SECONDS } from "../../../src/lib/cache/kv.js";
import type { HealthReport } from "../../../src/lib/scoring/types.js";

/**
 * Unit tests for the KV cache retention/freshness policy. These use a fake
 * KVNamespace that captures the `put` options, so they lock the production
 * behavior that miniflare's real-clock TTL can't exercise in a fast test:
 * retention must outlive the freshness window so the stale-serve fallback has
 * something to return.
 */

function fakeReport(): HealthReport {
  return {
    schemaVersion: "repopulse.v1",
    repo: "o/n",
    score: 50,
    grade: "D",
    signals: {} as HealthReport["signals"],
    weights: {} as HealthReport["weights"],
    flags: [],
    summary: "s",
    generatedAt: "2026-07-11T00:00:00.000Z",
  };
}

interface PutCall {
  key: string;
  value: string;
  options?: { expirationTtl?: number };
}

function fakeKv(store = new Map<string, string>()) {
  const puts: PutCall[] = [];
  const kv = {
    async get(key: string) {
      return store.get(key) ?? null;
    },
    async put(key: string, value: string, options?: { expirationTtl?: number }) {
      puts.push({ key, value, ...(options ? { options } : {}) });
      store.set(key, value);
    },
    async delete(key: string) {
      store.delete(key);
    },
  } as unknown as KVNamespace;
  return { kv, puts, store };
}

describe("HealthCache retention policy", () => {
  it("retains entries well beyond the freshness window (stale-serve reachability)", async () => {
    const ttlSeconds = 900;
    const { kv, puts } = fakeKv();
    const cache = new HealthCache(kv, { ttlSeconds });
    await cache.set("o/n", fakeReport(), 1_000_000);

    expect(puts).toHaveLength(1);
    const ttl = puts[0]?.options?.expirationTtl ?? 0;
    // The bug this guards against: expirationTtl === ttlSeconds would hard-evict
    // the entry exactly when it becomes stale, so the fallback could never fire.
    expect(ttl).toBe(ttlSeconds + STALE_RETENTION_SECONDS);
    expect(ttl).toBeGreaterThan(ttlSeconds);
  });

  it("isFresh reflects only the freshness window, not retention", async () => {
    const ttlSeconds = 900;
    const { kv } = fakeKv();
    const cache = new HealthCache(kv, { ttlSeconds });
    const now = 1_000_000;
    const entry = { report: fakeReport(), cachedAt: now };

    expect(cache.isFresh(entry, now)).toBe(true);
    expect(cache.isFresh(entry, now + (ttlSeconds - 1) * 1000)).toBe(true);
    expect(cache.isFresh(entry, now + ttlSeconds * 1000)).toBe(false);
    // Still not fresh deep into the retention grace, but the entry would still
    // exist in KV for the stale-serve path.
    expect(cache.isFresh(entry, now + (ttlSeconds + 3600) * 1000)).toBe(false);
  });

  it("round-trips a cached report and rejects malformed entries", async () => {
    const { kv, store } = fakeKv();
    const cache = new HealthCache(kv, { ttlSeconds: 900 });
    await cache.set("o/n", fakeReport(), 42);
    const got = await cache.get("o/n");
    expect(got?.cachedAt).toBe(42);
    expect(got?.report.repo).toBe("o/n");

    store.set("health:bad/x", "not json");
    expect(await cache.get("bad/x")).toBeNull();
  });
});
