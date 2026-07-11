import type { RepoSnapshot } from "../../src/lib/scoring/snapshot.js";

/**
 * A brand-new, sparse starter repo: committed a few days before `asOf` (so
 * commit recency is high), but no releases yet, no CI, no tests, an empty issue
 * tracker and only a couple of contributors. Exercises the "defined neutral"
 * empty-data paths (issues/PRs). Expected to grade around D.
 */
export const minimalRepo: RepoSnapshot = {
  asOf: "2026-07-11T00:00:00.000Z",
  meta: {
    fullName: "newdev/starter-kit",
    archived: false,
    fork: false,
    disabled: false,
    description: "A tiny starter kit.",
    license: "MIT",
    defaultBranch: "main",
    pushedAt: "2026-07-05T00:00:00.000Z",
    createdAt: "2026-06-20T00:00:00.000Z",
    stars: 3,
    openIssues: 0,
  },
  commits: [
    { date: "2026-07-05T00:00:00.000Z", authorLogin: "newdev" },
    { date: "2026-06-28T00:00:00.000Z", authorLogin: "helper" },
    { date: "2026-06-20T00:00:00.000Z", authorLogin: "newdev" },
  ],
  releases: [],
  issues: [],
  pulls: [],
  contributors: [
    { login: "newdev", contributions: 10 },
    { login: "helper", contributions: 6 },
  ],
  tree: [
    { path: "README.md", type: "blob" },
    { path: "index.js", type: "blob" },
    { path: "package.json", type: "blob" },
  ],
  dependencies: {
    manifest: "package.json",
    total: 3,
    pinned: 1,
  },
};
