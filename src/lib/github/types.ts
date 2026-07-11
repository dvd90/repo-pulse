/**
 * Minimal shapes of the GitHub REST v3 responses we consume. Only the fields we
 * actually read are modeled; everything else is ignored.
 */

export interface GhRepo {
  full_name: string;
  archived: boolean;
  fork: boolean;
  disabled: boolean;
  description: string | null;
  license: { spdx_id: string | null; name: string | null } | null;
  default_branch: string;
  pushed_at: string | null;
  created_at: string | null;
  stargazers_count: number;
  open_issues_count: number;
}

export interface GhCommit {
  commit: { author: { date: string | null } | null; committer: { date: string | null } | null };
  author: { login: string } | null;
}

export interface GhRelease {
  tag_name: string;
  published_at: string | null;
  draft: boolean;
  prerelease: boolean;
}

export interface GhIssue {
  number: number;
  state: "open" | "closed";
  created_at: string;
  closed_at: string | null;
  comments: number;
  pull_request?: unknown;
}

export interface GhPull {
  number: number;
  state: "open" | "closed";
  created_at: string;
  closed_at: string | null;
  merged_at: string | null;
}

export interface GhContributor {
  login: string;
  contributions: number;
}

export interface GhTreeEntry {
  path: string;
  type: "blob" | "tree" | "commit";
}

export interface GhTree {
  tree: GhTreeEntry[];
  truncated: boolean;
}

export interface GhContents {
  /** base64-encoded when `encoding === "base64"`. */
  content?: string;
  encoding?: string;
}
