import { env } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import { getHealthReport } from "../../src/lib/health.js";
import { parseEnv } from "../../src/env.js";
import { parseRepo } from "../../src/lib/repo.js";
import { createLogger } from "../../src/lib/log.js";
import { makeMockFetch, toGitHubBase64, type MockRoute } from "../lib/github/mockFetch.js";

/**
 * Exercises the health service end-to-end against a REAL Workers KV binding
 * (via the vitest workers pool) with the GitHub boundary mocked. Covers the
 * fresh-fetch, cache-hit, and stale-serve paths.
 */

const ASOF_MS = Date.parse("2026-07-11T00:00:00.000Z");

function healthyRoutes(): MockRoute[] {
  return [
    {
      match: "/repos/o/n",
      json: {
        full_name: "o/n",
        archived: false,
        fork: false,
        disabled: false,
        description: "desc",
        license: { spdx_id: "MIT", name: "MIT" },
        default_branch: "main",
        pushed_at: "2026-07-10T00:00:00Z",
        created_at: "2023-01-01T00:00:00Z",
        stargazers_count: 500,
        open_issues_count: 4,
      },
    },
    {
      match: "/repos/o/n/commits",
      json: [
        { commit: { committer: { date: "2026-07-10T00:00:00Z" } }, author: { login: "a" } },
        { commit: { committer: { date: "2026-07-05T00:00:00Z" } }, author: { login: "b" } },
        { commit: { committer: { date: "2026-07-01T00:00:00Z" } }, author: { login: "c" } },
      ],
    },
    {
      match: "/repos/o/n/releases",
      json: [
        { tag_name: "v1", published_at: "2026-06-20T00:00:00Z", draft: false, prerelease: false },
      ],
    },
    {
      match: "/repos/o/n/issues",
      json: [
        {
          number: 1,
          state: "closed",
          created_at: "2026-05-01T00:00:00Z",
          closed_at: "2026-05-02T00:00:00Z",
          comments: 1,
        },
      ],
    },
    {
      match: "/repos/o/n/pulls",
      json: [
        {
          number: 2,
          state: "closed",
          created_at: "2026-06-01T00:00:00Z",
          closed_at: "2026-06-02T00:00:00Z",
          merged_at: "2026-06-02T00:00:00Z",
        },
      ],
    },
    {
      match: "/repos/o/n/contributors",
      json: [
        { login: "a", contributions: 50 },
        { login: "b", contributions: 40 },
        { login: "c", contributions: 30 },
      ],
    },
    {
      match: "/repos/o/n/git/trees",
      prefix: true,
      json: {
        truncated: false,
        tree: [
          { path: "README.md", type: "blob" },
          { path: ".github/workflows/ci.yml", type: "blob" },
          { path: "test/x.test.ts", type: "blob" },
          { path: "package.json", type: "blob" },
        ],
      },
    },
    {
      match: "/repos/o/n/contents/package.json",
      json: {
        encoding: "base64",
        content: toGitHubBase64(JSON.stringify({ dependencies: { hono: "4.0.0" } })),
      },
    },
  ];
}

const repo = parseRepo("o/n");

beforeEach(async () => {
  // Clear any cache entry between tests for determinism.
  await env.HEALTH_CACHE.delete("health:o/n");
});

describe("getHealthReport", () => {
  it("fetches, scores, and caches on a cold miss", async () => {
    const config = parseEnv(env);
    const res = await getHealthReport(repo, {
      config,
      log: createLogger("t"),
      now: () => ASOF_MS,
      fetchImpl: makeMockFetch(healthyRoutes()),
    });
    expect(res.fromCache).toBe(false);
    expect(res.report.repo).toBe("o/n");
    expect(res.report.score).toBeGreaterThan(0);
    expect(res.report.score).toBeLessThanOrEqual(100);
    expect(res.report.schemaVersion).toBe("repopulse.v1");
    // Cached now
    const raw = await env.HEALTH_CACHE.get("health:o/n");
    expect(raw).toBeTruthy();
  });

  it("serves a fresh cache hit without calling GitHub", async () => {
    const config = parseEnv(env);
    const deps = { config, log: createLogger("t"), now: () => ASOF_MS };
    await getHealthReport(repo, { ...deps, fetchImpl: makeMockFetch(healthyRoutes()) });

    // Second call with a fetch that would throw if used.
    const throwingFetch = (() => {
      throw new Error("should not fetch on fresh hit");
    }) as unknown as typeof fetch;
    const res = await getHealthReport(repo, { ...deps, fetchImpl: throwingFetch });
    expect(res.fromCache).toBe(true);
    expect(res.report.stale).toBeUndefined();
  });

  it("serves stale with stale:true when GitHub rate-limits and cache is old", async () => {
    const config = parseEnv(env);
    // Seed a fresh entry at ASOF.
    await getHealthReport(repo, {
      config,
      log: createLogger("t"),
      now: () => ASOF_MS,
      fetchImpl: makeMockFetch(healthyRoutes()),
    });
    // Advance beyond the TTL so the entry is stale; GitHub now rate-limits.
    const later = ASOF_MS + (config.CACHE_TTL_SECONDS + 60) * 1000;
    const rateLimited = makeMockFetch([
      {
        match: "/repos/o/n",
        status: 403,
        json: {},
        headers: { "x-ratelimit-remaining": "0", "retry-after": "30" },
      },
    ]);
    const res = await getHealthReport(repo, {
      config,
      log: createLogger("t"),
      now: () => later,
      fetchImpl: rateLimited,
    });
    expect(res.fromCache).toBe(true);
    expect(res.report.stale).toBe(true);
  });

  it("propagates repo_not_found when nothing is cached", async () => {
    const config = parseEnv(env);
    await expect(
      getHealthReport(repo, {
        config,
        log: createLogger("t"),
        now: () => ASOF_MS,
        fetchImpl: makeMockFetch([], { notFoundOnMiss: true }),
      }),
    ).rejects.toMatchObject({ code: "repo_not_found" });
  });
});
