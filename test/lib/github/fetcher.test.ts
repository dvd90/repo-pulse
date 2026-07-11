import { describe, it, expect } from "vitest";
import { fetchRepoSnapshot } from "../../../src/lib/github/fetcher.js";
import { parseRepo } from "../../../src/lib/repo.js";
import { makeMockFetch, toGitHubBase64 } from "./mockFetch.js";

const ASOF = "2026-07-11T00:00:00.000Z";

function fullRoutes() {
  return [
    {
      match: "/repos/o/n/commits",
      json: [
        {
          commit: {
            committer: { date: "2026-07-10T00:00:00Z" },
            author: { date: "2026-07-10T00:00:00Z" },
          },
          author: { login: "alice" },
        },
        {
          commit: {
            committer: { date: "2026-07-01T00:00:00Z" },
            author: { date: "2026-07-01T00:00:00Z" },
          },
          author: { login: "bob" },
        },
      ],
    },
    {
      match: "/repos/o/n/releases",
      json: [
        {
          tag_name: "v1.2.0",
          published_at: "2026-06-20T00:00:00Z",
          draft: false,
          prerelease: false,
        },
      ],
    },
    {
      match: "/repos/o/n/issues",
      json: [
        {
          number: 5,
          state: "closed",
          created_at: "2026-05-01T00:00:00Z",
          closed_at: "2026-05-03T00:00:00Z",
          comments: 2,
        },
        {
          number: 6,
          state: "open",
          created_at: "2026-06-01T00:00:00Z",
          closed_at: null,
          comments: 0,
          pull_request: {},
        },
      ],
    },
    {
      match: "/repos/o/n/pulls",
      json: [
        {
          number: 10,
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
        { login: "alice", contributions: 120 },
        { login: "bob", contributions: 30 },
      ],
    },
    {
      match: "/repos/o/n/git/trees",
      prefix: true,
      json: {
        truncated: false,
        tree: [
          { path: "README.md", type: "blob" },
          { path: "package.json", type: "blob" },
          { path: ".github/workflows/ci.yml", type: "blob" },
          { path: "test/app.test.ts", type: "blob" },
          { path: "docs/guide.md", type: "blob" },
        ],
      },
    },
    {
      match: "/repos/o/n/contents/package.json",
      json: {
        encoding: "base64",
        content: toGitHubBase64(
          JSON.stringify({
            dependencies: { hono: "4.0.0" },
            devDependencies: { vitest: "^4.0.0" },
          }),
        ),
      },
    },
    // Repo meta — shortest match so it loses to the more specific paths above.
    {
      match: "/repos/o/n",
      json: {
        full_name: "o/n",
        archived: false,
        fork: false,
        disabled: false,
        description: "A test repo",
        license: { spdx_id: "MIT", name: "MIT License" },
        default_branch: "main",
        pushed_at: "2026-07-10T00:00:00Z",
        created_at: "2024-01-01T00:00:00Z",
        stargazers_count: 999,
        open_issues_count: 3,
      },
    },
  ];
}

describe("fetchRepoSnapshot", () => {
  it("assembles a normalized snapshot from GitHub responses", async () => {
    const snap = await fetchRepoSnapshot(parseRepo("o/n"), {
      timeoutMs: 5000,
      asOf: ASOF,
      fetchImpl: makeMockFetch(fullRoutes()),
    });

    expect(snap.asOf).toBe(ASOF);
    expect(snap.meta).toMatchObject({
      fullName: "o/n",
      license: "MIT",
      defaultBranch: "main",
      stars: 999,
      archived: false,
    });
    expect(snap.commits).toHaveLength(2);
    expect(snap.commits[0]).toEqual({ date: "2026-07-10T00:00:00Z", authorLogin: "alice" });
    expect(snap.releases[0]?.tagName).toBe("v1.2.0");
    // issue #6 is a PR
    expect(snap.issues.find((i) => i.number === 6)?.isPullRequest).toBe(true);
    expect(snap.issues.find((i) => i.number === 5)?.isPullRequest).toBe(false);
    expect(snap.pulls[0]?.mergedAt).toBe("2026-06-02T00:00:00Z");
    expect(snap.contributors).toHaveLength(2);
    expect(snap.tree.some((e) => e.path === ".github/workflows/ci.yml")).toBe(true);
    expect(snap.dependencies).toEqual({ manifest: "package.json", total: 2, pinned: 1 });
  });

  it("throws repo_not_found when repo meta is 404", async () => {
    await expect(
      fetchRepoSnapshot(parseRepo("o/n"), {
        timeoutMs: 5000,
        asOf: ASOF,
        fetchImpl: makeMockFetch([], { notFoundOnMiss: true }),
      }),
    ).rejects.toMatchObject({ code: "repo_not_found" });
  });

  it("degrades gracefully when optional resources are missing", async () => {
    const routes = [
      {
        match: "/repos/o/n",
        json: {
          full_name: "o/n",
          archived: true,
          fork: true,
          disabled: false,
          description: null,
          license: null,
          default_branch: "main",
          pushed_at: "2020-01-01T00:00:00Z",
          created_at: "2019-01-01T00:00:00Z",
          stargazers_count: 1,
          open_issues_count: 0,
        },
      },
    ];
    const snap = await fetchRepoSnapshot(parseRepo("o/n"), {
      timeoutMs: 5000,
      asOf: ASOF,
      fetchImpl: makeMockFetch(routes, { notFoundOnMiss: true }),
    });
    expect(snap.commits).toEqual([]);
    expect(snap.releases).toEqual([]);
    expect(snap.tree).toEqual([]);
    expect(snap.dependencies).toBeNull();
    expect(snap.meta.license).toBeNull();
    expect(snap.meta.archived).toBe(true);
  });
});
