import { AppError } from "./errors.js";

export interface RepoRef {
  owner: string;
  name: string;
  /** Canonical `owner/name` form. */
  full: string;
}

// GitHub owner rules: 1–39 chars, alphanumeric or single hyphens, no leading/
// trailing hyphen. Repo names: 1–100 chars from [A-Za-z0-9._-]. We reject "."
// and ".." repo names which GitHub disallows.
const OWNER_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;
const NAME_RE = /^[A-Za-z0-9._-]{1,100}$/;

/**
 * Strictly parse an `owner/name` repo identifier. Throws `invalid_repo` (400)
 * on anything malformed — this guards every downstream GitHub call.
 */
export function parseRepo(input: string | undefined | null): RepoRef {
  if (!input || typeof input !== "string") {
    throw new AppError("invalid_repo", "Missing 'repo' query parameter (expected owner/name)");
  }
  const trimmed = input.trim();
  const parts = trimmed.split("/");
  if (parts.length !== 2) {
    throw new AppError(
      "invalid_repo",
      `Invalid repo '${input}': expected exactly one '/' (owner/name)`,
    );
  }
  const [owner, name] = parts as [string, string];
  if (!OWNER_RE.test(owner)) {
    throw new AppError("invalid_repo", `Invalid owner '${owner}'`);
  }
  if (!NAME_RE.test(name) || name === "." || name === "..") {
    throw new AppError("invalid_repo", `Invalid repo name '${name}'`);
  }
  return { owner, name, full: `${owner}/${name}` };
}
