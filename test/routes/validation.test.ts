import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { createApp } from "../../src/app.js";
import { createFakeFacilitator } from "../lib/x402/fakeFacilitator.js";

/**
 * The `repo` parameter is validated BEFORE the payment gate, so malformed
 * requests get a 400 (and are never charged) rather than a 402.
 */
describe("pre-payment validation on /v1/health", () => {
  const { client } = createFakeFacilitator("eip155:8453");

  it("returns 400 for a malformed repo before charging", async () => {
    const app = createApp({ facilitatorClient: client, syncFacilitatorOnStart: true });
    const res = await app.request("/v1/health?repo=not-a-valid-repo", {}, env);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { ok: boolean; error: { code: string } };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("invalid_repo");
  });

  it("returns 400 when repo is missing", async () => {
    const app = createApp({ facilitatorClient: client, syncFacilitatorOnStart: true });
    const res = await app.request("/v1/health", {}, env);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("invalid_repo");
  });

  it("returns 402 (not 400) for a well-formed repo when unpaid", async () => {
    const app = createApp({ facilitatorClient: client, syncFacilitatorOnStart: true });
    const res = await app.request("/v1/health?repo=honojs/hono", {}, env);
    expect(res.status).toBe(402);
  });
});
