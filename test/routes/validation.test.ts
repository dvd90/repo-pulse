import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { createApp } from "../../src/app.js";
import { createFakeFacilitator } from "../lib/x402/fakeFacilitator.js";

/**
 * Validation order around the payment gate: an UNPAID request always gets the
 * 402 challenge (indexers probe the bare URL), while a PAYING request with a
 * malformed repo 400s before its payment is settled — nobody is charged for a
 * typo.
 */
describe("validation around the payment gate on /v1/health", () => {
  const { client } = createFakeFacilitator("eip155:8453");

  it("returns the 402 challenge when unpaid, even without a repo param", async () => {
    const app = createApp({ facilitatorClient: client, syncFacilitatorOnStart: true });
    const res = await app.request("/v1/health", {}, env);
    expect(res.status).toBe(402);
  });

  it("returns the 402 challenge when unpaid with a malformed repo", async () => {
    const app = createApp({ facilitatorClient: client, syncFacilitatorOnStart: true });
    const res = await app.request("/v1/health?repo=not-a-valid-repo", {}, env);
    expect(res.status).toBe(402);
  });

  it("returns 402 for a well-formed repo when unpaid", async () => {
    const app = createApp({ facilitatorClient: client, syncFacilitatorOnStart: true });
    const res = await app.request("/v1/health?repo=honojs/hono", {}, env);
    expect(res.status).toBe(402);
  });

  it("400s a malformed repo BEFORE settling when a payment header is present", async () => {
    const { client: freshClient, calls } = createFakeFacilitator("eip155:8453");
    const app = createApp({ facilitatorClient: freshClient, syncFacilitatorOnStart: true });
    const res = await app.request(
      "/v1/health?repo=not-a-valid-repo",
      { headers: { "PAYMENT-SIGNATURE": "not-a-real-payment" } },
      env,
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { ok: boolean; error: { code: string } };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("invalid_repo");
    // The facilitator was never asked to verify or settle the payment.
    expect(calls.verify).toBe(0);
    expect(calls.settle).toBe(0);
  });
});
