import { AppError } from "../errors.js";
import type { Logger } from "../log.js";

/**
 * Thin GitHub REST v3 client. Responsible only for authenticated fetches with a
 * shared timeout budget and for classifying GitHub failures into `AppError`s.
 * Normalization into a `RepoSnapshot` lives in `fetcher.ts`; this layer is the
 * HTTP boundary that tests mock.
 */

const GITHUB_API = "https://api.github.com";

export interface GitHubClientOptions {
  token?: string | undefined;
  /** Per-request timeout in milliseconds. */
  timeoutMs: number;
  log?: Logger | undefined;
  /** Injectable fetch for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

/** Result of a GitHub GET: parsed JSON plus a few relevant response headers. */
export interface GitHubResponse<T> {
  status: number;
  data: T;
  /** Remaining rate-limit budget, if the header was present. */
  rateLimitRemaining: number | null;
  /** Unix seconds when the rate limit resets, if present. */
  rateLimitReset: number | null;
}

export class GitHubClient {
  private readonly token: string | undefined;
  private readonly timeoutMs: number;
  private readonly log: Logger | undefined;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: GitHubClientOptions) {
    this.token = opts.token && opts.token.length > 0 ? opts.token : undefined;
    this.timeoutMs = opts.timeoutMs;
    this.log = opts.log;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  private headers(): HeadersInit {
    const h: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "User-Agent": "RepoPulse/1.0 (+https://repo-pulse)",
      "X-GitHub-Api-Version": "2022-11-28",
    };
    if (this.token) h.Authorization = `Bearer ${this.token}`;
    return h;
  }

  /**
   * GET a GitHub API path. `path` may be absolute (starting with http) or a
   * `/repos/...` path. Returns parsed JSON. Throws `AppError` on 404
   * (`repo_not_found`), 403/429 rate limits (`upstream_rate_limited` with
   * `retryAfter`), timeouts (`upstream_timeout`), and other failures
   * (`upstream_error`).
   *
   * `allow404` lets callers treat 404 as an empty result (used for optional
   * resources like a missing manifest) instead of throwing.
   */
  async get<T>(path: string, opts?: { allow404?: boolean }): Promise<GitHubResponse<T> | null> {
    const url = path.startsWith("http") ? path : `${GITHUB_API}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let res: Response;
    try {
      res = await this.fetchImpl(url, { headers: this.headers(), signal: controller.signal });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new AppError(
          "upstream_timeout",
          `GitHub request timed out after ${this.timeoutMs}ms`,
          504,
        );
      }
      throw new AppError(
        "upstream_error",
        `GitHub request failed: ${err instanceof Error ? err.message : "unknown"}`,
        502,
      );
    } finally {
      clearTimeout(timer);
    }

    const rateLimitRemaining = parseIntHeader(res.headers.get("x-ratelimit-remaining"));
    const rateLimitReset = parseIntHeader(res.headers.get("x-ratelimit-reset"));

    if (res.status === 404) {
      if (opts?.allow404) return null;
      throw new AppError("repo_not_found", "Repository not found or not public", 404);
    }

    // GitHub signals rate limiting with 403 (primary) or 429 (secondary) plus a
    // zero remaining budget or a Retry-After header.
    if (res.status === 403 || res.status === 429) {
      const retryAfter = computeRetryAfter(res.headers.get("retry-after"), rateLimitReset);
      if (res.status === 429 || rateLimitRemaining === 0 || retryAfter !== null) {
        this.log?.warn("github_rate_limited", { status: res.status, retryAfter });
        throw new AppError(
          "upstream_rate_limited",
          "GitHub API rate limit reached",
          503,
          retryAfter !== null ? { retryAfter } : undefined,
        );
      }
    }

    if (res.status < 200 || res.status >= 300) {
      const body = await safeText(res);
      throw new AppError(
        "upstream_error",
        `GitHub returned ${res.status}: ${body.slice(0, 200)}`,
        502,
      );
    }

    const data = (await res.json()) as T;
    return { status: res.status, data, rateLimitRemaining, rateLimitReset };
  }
}

function parseIntHeader(v: string | null): number | null {
  if (v === null) return null;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * Compute a Retry-After in seconds from either the `Retry-After` header
 * (seconds) or the `x-ratelimit-reset` epoch. Returns null if neither yields a
 * positive delay. Uses the reset epoch relative to a caller-agnostic clock; a
 * small floor keeps it sane.
 */
function computeRetryAfter(retryAfterHeader: string | null, reset: number | null): number | null {
  const parsed = parseIntHeader(retryAfterHeader);
  if (parsed !== null && parsed >= 0) return parsed;
  if (reset !== null) {
    const nowSec = Math.floor(Date.now() / 1000);
    const delta = reset - nowSec;
    if (delta > 0) return Math.min(delta, 3600);
  }
  return null;
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}
