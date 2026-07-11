/**
 * A small mock `fetch` that routes GitHub API paths to canned JSON responses.
 * The fetcher/client are the only network boundary in RepoPulse, so mocking
 * here keeps every other test fully offline and deterministic.
 *
 * Matching is on the URL pathname (query stripped) and EXACT by default, so a
 * parent path like `/repos/o/n` never accidentally swallows `/repos/o/n/commits`.
 * Set `prefix: true` for routes that must match a family of paths (e.g. the git
 * trees endpoint, whose branch is appended).
 */

export interface MockRoute {
  /** Pathname matched against the request URL (query stripped). */
  match: string;
  /** When true, match by prefix instead of exact pathname equality. */
  prefix?: boolean;
  status?: number;
  json?: unknown;
  text?: string;
  headers?: Record<string, string>;
}

export interface MockFetchOptions {
  /** If true, a URL matching no route yields 404 instead of throwing. */
  notFoundOnMiss?: boolean;
}

export function makeMockFetch(routes: MockRoute[], opts: MockFetchOptions = {}): typeof fetch {
  const fn = async (input: RequestInfo | URL): Promise<Response> => {
    const raw =
      typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const pathname = new URL(raw).pathname;

    const route = routes
      .filter((r) => (r.prefix ? pathname.startsWith(r.match) : pathname === r.match))
      .sort((a, b) => b.match.length - a.match.length)[0];

    if (!route) {
      if (opts.notFoundOnMiss) return jsonResponse(404, { message: "Not Found" });
      throw new Error(`mockFetch: no route for ${pathname}`);
    }
    const status = route.status ?? 200;
    const headers = new Headers(route.headers ?? {});
    if (route.text !== undefined) {
      return new Response(route.text, { status, headers });
    }
    headers.set("content-type", "application/json");
    return new Response(JSON.stringify(route.json ?? {}), { status, headers });
  };
  return fn as unknown as typeof fetch;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Base64-encode a UTF-8 string the way GitHub's contents API returns it. */
export function toGitHubBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}
