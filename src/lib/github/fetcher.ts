import type {
  RepoSnapshot,
  SnapshotCommit,
  SnapshotContributor,
  SnapshotIssue,
  SnapshotPull,
  SnapshotRelease,
  SnapshotTreeEntry,
} from "../scoring/snapshot.js";
import type { RepoRef } from "../repo.js";
import type { Logger } from "../log.js";
import { GitHubClient } from "./client.js";
import { detectManifest, parseManifest } from "./dependencies.js";
import type {
  GhCommit,
  GhContents,
  GhContributor,
  GhIssue,
  GhPull,
  GhRelease,
  GhRepo,
  GhTree,
} from "./types.js";

/** How many items to pull per list endpoint. Bounds latency and payload size. */
const PER_PAGE = 100;

export interface FetchOptions {
  token?: string | undefined;
  timeoutMs: number;
  log?: Logger | undefined;
  fetchImpl?: typeof fetch;
  /**
   * Reference "now" for the snapshot (ISO). Defaults to the current time.
   * Injectable so tests get stable, deterministic snapshots.
   */
  asOf?: string;
}

/**
 * Fetch a normalized {@link RepoSnapshot} for a repository. Makes the repo-meta
 * call first (it yields the default branch), then fans out the remaining calls
 * in parallel under the shared timeout budget. Optional resources (tree,
 * manifest) degrade gracefully to empty rather than failing the whole request.
 */
export async function fetchRepoSnapshot(repo: RepoRef, opts: FetchOptions): Promise<RepoSnapshot> {
  const client = new GitHubClient({
    token: opts.token,
    timeoutMs: opts.timeoutMs,
    log: opts.log,
    ...(opts.fetchImpl ? { fetchImpl: opts.fetchImpl } : {}),
  });
  const base = `/repos/${repo.owner}/${repo.name}`;
  const asOf = opts.asOf ?? new Date().toISOString();

  // 1. Repo metadata (must succeed; 404 -> repo_not_found via client).
  const repoRes = await client.get<GhRepo>(base);
  // get() only returns null for allow404; without it, a non-2xx throws.
  const gh = repoRes!.data;

  // 2. Fan out the rest in parallel. Each optional list tolerates absence.
  const [commits, releases, issues, pulls, contributors, tree] = await Promise.all([
    client
      .get<GhCommit[]>(`${base}/commits?per_page=${PER_PAGE}`, { allow404: true })
      .then((r) => r?.data ?? []),
    client
      .get<GhRelease[]>(`${base}/releases?per_page=${PER_PAGE}`, { allow404: true })
      .then((r) => r?.data ?? []),
    client
      .get<GhIssue[]>(`${base}/issues?state=all&per_page=${PER_PAGE}`, { allow404: true })
      .then((r) => r?.data ?? []),
    client
      .get<GhPull[]>(`${base}/pulls?state=all&per_page=${PER_PAGE}`, { allow404: true })
      .then((r) => r?.data ?? []),
    client
      .get<GhContributor[]>(`${base}/contributors?per_page=${PER_PAGE}`, { allow404: true })
      .then((r) => r?.data ?? []),
    client
      .get<GhTree>(`${base}/git/trees/${gh.default_branch}?recursive=1`, { allow404: true })
      .then((r) => r?.data ?? null),
  ]);

  const treeEntries: SnapshotTreeEntry[] = (tree?.tree ?? [])
    .filter(
      (e): e is { path: string; type: "blob" | "tree" } => e.type === "blob" || e.type === "tree",
    )
    .map((e) => ({ path: e.path, type: e.type }));

  // 3. Dependency manifest (best-effort): detect from the tree, fetch, parse.
  const dependencies = await fetchDependencies(client, base, treeEntries);

  return {
    asOf,
    meta: {
      fullName: gh.full_name,
      archived: gh.archived,
      fork: gh.fork,
      disabled: gh.disabled,
      description: gh.description,
      license:
        gh.license?.spdx_id && gh.license.spdx_id !== "NOASSERTION" ? gh.license.spdx_id : null,
      defaultBranch: gh.default_branch,
      pushedAt: gh.pushed_at,
      createdAt: gh.created_at,
      stars: gh.stargazers_count,
      openIssues: gh.open_issues_count,
    },
    commits: commits.map(toSnapshotCommit),
    releases: releases.map(toSnapshotRelease),
    issues: issues.map(toSnapshotIssue),
    pulls: pulls.map(toSnapshotPull),
    contributors: contributors.map(toSnapshotContributor),
    tree: treeEntries,
    dependencies,
  };
}

async function fetchDependencies(
  client: GitHubClient,
  base: string,
  tree: SnapshotTreeEntry[],
): Promise<RepoSnapshot["dependencies"]> {
  const manifest = detectManifest(tree);
  if (!manifest) return null;
  const res = await client.get<GhContents>(`${base}/contents/${manifest}`, { allow404: true });
  if (!res || !res.data.content) return { manifest, total: 0, pinned: 0 };
  const raw = decodeBase64Content(res.data);
  if (raw === null) return { manifest, total: 0, pinned: 0 };
  return parseManifest(manifest, raw) ?? { manifest, total: 0, pinned: 0 };
}

function decodeBase64Content(contents: GhContents): string | null {
  if (contents.encoding !== "base64" || !contents.content) return null;
  try {
    // GitHub wraps base64 in newlines.
    const cleaned = contents.content.replace(/\n/g, "");
    const binary = atob(cleaned);
    const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

function toSnapshotCommit(c: GhCommit): SnapshotCommit {
  const date = c.commit.committer?.date ?? c.commit.author?.date ?? "";
  return { date, authorLogin: c.author?.login ?? null };
}

function toSnapshotRelease(r: GhRelease): SnapshotRelease {
  return {
    tagName: r.tag_name,
    publishedAt: r.published_at,
    draft: r.draft,
    prerelease: r.prerelease,
  };
}

function toSnapshotIssue(i: GhIssue): SnapshotIssue {
  return {
    number: i.number,
    state: i.state,
    createdAt: i.created_at,
    closedAt: i.closed_at,
    isPullRequest: i.pull_request !== undefined,
    comments: i.comments,
  };
}

function toSnapshotPull(p: GhPull): SnapshotPull {
  return {
    number: p.number,
    state: p.state,
    createdAt: p.created_at,
    closedAt: p.closed_at,
    mergedAt: p.merged_at,
  };
}

function toSnapshotContributor(c: GhContributor): SnapshotContributor {
  return { login: c.login, contributions: c.contributions };
}
