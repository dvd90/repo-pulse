/**
 * `RepoSnapshot` is the normalized, GitHub-agnostic input to the scoring engine.
 * The fetcher (`src/lib/github`) produces it from raw GitHub REST responses; the
 * signal calculators consume only this. Keeping the boundary here means scoring
 * tests never touch HTTP — they build snapshots directly.
 *
 * All timestamps are ISO-8601 strings. `asOf` is the reference "now" used for
 * every recency calculation, so scoring is a pure function of the snapshot
 * (deterministic — no `Date.now()` inside the scorers).
 */

export interface SnapshotRepoMeta {
  fullName: string;
  archived: boolean;
  fork: boolean;
  disabled: boolean;
  description: string | null;
  license: string | null;
  defaultBranch: string;
  pushedAt: string | null;
  createdAt: string | null;
  stars: number;
  openIssues: number;
}

export interface SnapshotCommit {
  /** ISO date the commit was authored/committed. */
  date: string;
  /** Login of the author, or null if unattributed. */
  authorLogin: string | null;
}

export interface SnapshotRelease {
  tagName: string;
  publishedAt: string | null;
  draft: boolean;
  prerelease: boolean;
}

export interface SnapshotIssue {
  number: number;
  state: "open" | "closed";
  createdAt: string;
  closedAt: string | null;
  /** Whether this item is actually a pull request (GitHub issues API mixes them). */
  isPullRequest: boolean;
  comments: number;
}

export interface SnapshotPull {
  number: number;
  state: "open" | "closed";
  createdAt: string;
  closedAt: string | null;
  mergedAt: string | null;
}

export interface SnapshotContributor {
  login: string;
  contributions: number;
}

/** A repository tree entry (path only) used to detect CI/test/docs presence. */
export interface SnapshotTreeEntry {
  path: string;
  type: "blob" | "tree";
}

export interface RepoSnapshot {
  /** Reference "now" for all recency math (ISO-8601). */
  asOf: string;
  meta: SnapshotRepoMeta;
  /** Most recent commits on the default branch (newest first), capped by fetcher. */
  commits: SnapshotCommit[];
  releases: SnapshotRelease[];
  /** Recent issues+PRs from the issues endpoint (newest first). */
  issues: SnapshotIssue[];
  /** Recent pull requests (newest first). */
  pulls: SnapshotPull[];
  contributors: SnapshotContributor[];
  /** Paths at the repo root (and shallow tree) used for structural signals. */
  tree: SnapshotTreeEntry[];
  /** Whether a dependency manifest was found and, if so, its freshness inputs. */
  dependencies: SnapshotDependencies | null;
}

export interface SnapshotDependencies {
  /** Manifest kind detected (e.g. "package.json", "requirements.txt"). */
  manifest: string;
  /** Total direct dependencies declared. */
  total: number;
  /** How many use a pinned/wildcard-free spec (best-effort freshness proxy). */
  pinned: number;
}
