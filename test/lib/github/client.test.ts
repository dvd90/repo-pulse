import { describe, it, expect } from "vitest";
import { GitHubClient } from "../../../src/lib/github/client.js";
import { AppError } from "../../../src/lib/errors.js";
import { makeMockFetch } from "./mockFetch.js";

function client(fetchImpl: typeof fetch, timeoutMs = 5000) {
  return new GitHubClient({ timeoutMs, fetchImpl });
}

describe("GitHubClient", () => {
  it("returns parsed JSON on 200", async () => {
    const c = client(makeMockFetch([{ match: "/repos/o/n", json: { full_name: "o/n" } }]));
    const res = await c.get<{ full_name: string }>("/repos/o/n");
    expect(res?.data.full_name).toBe("o/n");
  });

  it("throws repo_not_found on 404 without allow404", async () => {
    const c = client(makeMockFetch([{ match: "/repos/o/n", status: 404, json: {} }]));
    await expect(c.get("/repos/o/n")).rejects.toMatchObject({
      code: "repo_not_found",
      status: 404,
    });
  });

  it("returns null on 404 with allow404", async () => {
    const c = client(makeMockFetch([{ match: "/repos/o/n", status: 404, json: {} }]));
    expect(await c.get("/repos/o/n", { allow404: true })).toBeNull();
  });

  it("maps rate-limit 403 to upstream_rate_limited with retryAfter", async () => {
    const c = client(
      makeMockFetch([
        {
          match: "/repos/o/n",
          status: 403,
          json: { message: "rate limited" },
          headers: { "x-ratelimit-remaining": "0", "retry-after": "42" },
        },
      ]),
    );
    await expect(c.get("/repos/o/n")).rejects.toMatchObject({
      code: "upstream_rate_limited",
      status: 503,
      details: { retryAfter: 42 },
    });
  });

  it("maps 429 to upstream_rate_limited", async () => {
    const c = client(makeMockFetch([{ match: "/repos/o/n", status: 429, json: {} }]));
    await expect(c.get("/repos/o/n")).rejects.toMatchObject({ code: "upstream_rate_limited" });
  });

  it("maps other non-2xx to upstream_error", async () => {
    const c = client(makeMockFetch([{ match: "/repos/o/n", status: 500, text: "boom" }]));
    await expect(c.get("/repos/o/n")).rejects.toMatchObject({
      code: "upstream_error",
      status: 502,
    });
  });

  it("maps an aborted request to upstream_timeout", async () => {
    const slow: typeof fetch = ((_url: RequestInfo | URL, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const e = new Error("aborted");
          e.name = "AbortError";
          reject(e);
        });
      })) as unknown as typeof fetch;
    const c = client(slow, 10);
    await expect(c.get("/repos/o/n")).rejects.toBeInstanceOf(AppError);
    await expect(c.get("/repos/o/n")).rejects.toMatchObject({ code: "upstream_timeout" });
  });
});
