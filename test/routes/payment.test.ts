import { env } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import { encodePaymentSignatureHeader, decodePaymentRequiredHeader } from "@x402/core/http";
import { createApp } from "../../src/app.js";
import { createFakeFacilitator } from "../lib/x402/fakeFacilitator.js";
import { makeMockFetch, type MockRoute } from "../lib/github/mockFetch.js";

/**
 * M2 integration test: the x402 402 → pay → retry flow, entirely in workerd
 * against a fake facilitator (no chain, no network). Proves the payment gate
 * blocks unpaid requests and admits a valid PAYMENT-SIGNATURE.
 */

const NETWORK = "eip155:8453" as const;

function githubRoutes(): MockRoute[] {
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
      json: [{ commit: { committer: { date: "2026-07-10T00:00:00Z" } }, author: { login: "a" } }],
    },
    { match: "/repos/o/n/releases", json: [] },
    { match: "/repos/o/n/issues", json: [] },
    { match: "/repos/o/n/pulls", json: [] },
    { match: "/repos/o/n/contributors", json: [{ login: "a", contributions: 10 }] },
    {
      match: "/repos/o/n/git/trees",
      prefix: true,
      json: { truncated: false, tree: [{ path: "README.md", type: "blob" }] },
    },
  ];
}

beforeEach(async () => {
  await env.HEALTH_CACHE.delete("health:o/n");
});

describe("x402 payment gate on /v1/health", () => {
  it("returns 402 with payment requirements when unpaid", async () => {
    const { client } = createFakeFacilitator(NETWORK);
    const app = createApp({ facilitatorClient: client, syncFacilitatorOnStart: true });

    const res = await app.request("/v1/health?repo=o/n", {}, env);
    expect(res.status).toBe(402);
    // x402 v2 carries payment requirements in the PAYMENT-REQUIRED header.
    const header = res.headers.get("payment-required");
    expect(header).toBeTruthy();
    const required = decodePaymentRequiredHeader(header!);
    const req0 = required.accepts[0];
    expect(req0?.scheme).toBe("exact");
    expect(req0?.network).toBe(NETWORK);
    // $0.01 USDC (6 decimals) = 10000 atomic units.
    expect(req0?.amount).toBe("10000");
    expect(req0?.payTo).toBe("0x000000000000000000000000000000000000dEaD");
    // Bazaar discovery extension is attached with the input schema.
    const bazaar = required.extensions?.bazaar as
      { info?: { input?: { queryParams?: unknown } } } | undefined;
    expect(bazaar?.info?.input?.queryParams).toBeDefined();
  });

  it("admits a valid PAYMENT-SIGNATURE and returns the health report", async () => {
    const { client, calls } = createFakeFacilitator(NETWORK);
    const app = createApp({
      facilitatorClient: client,
      syncFacilitatorOnStart: true,
      githubFetch: makeMockFetch(githubRoutes()),
    });

    // 1. Unpaid → 402, read requirements from the PAYMENT-REQUIRED header.
    const unpaid = await app.request("/v1/health?repo=o/n", {}, env);
    expect(unpaid.status).toBe(402);
    const required = decodePaymentRequiredHeader(unpaid.headers.get("payment-required")!);
    const requirements = required.accepts[0]!;

    // 2. Build a payment payload for the exact scheme and encode the header.
    const paymentPayload = {
      x402Version: 2,
      accepted: requirements,
      payload: {
        signature: "0x" + "00".repeat(65),
        authorization: {
          from: "0x1111111111111111111111111111111111111111",
          to: requirements.payTo,
          value: requirements.amount,
          validAfter: "0",
          validBefore: "99999999999",
          nonce: "0x" + "11".repeat(32),
        },
      },
    };
    const header = encodePaymentSignatureHeader(paymentPayload as never);

    // 3. Paid retry → 200 + report.
    const paid = await app.request(
      "/v1/health?repo=o/n",
      { headers: { "PAYMENT-SIGNATURE": header } },
      env,
    );
    expect(paid.status).toBe(200);
    const report = (await paid.json()) as {
      ok: boolean;
      data: { repo: string; score: number; grade: string };
    };
    expect(report.ok).toBe(true);
    expect(report.data.repo).toBe("o/n");
    expect(typeof report.data.score).toBe("number");

    // Facilitator was actually consulted.
    expect(calls.verify).toBeGreaterThanOrEqual(1);
    expect(calls.settle).toBeGreaterThanOrEqual(1);
  });
});
