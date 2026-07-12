import { describe, it, expect } from "vitest";
import { withStaticSupported } from "../../../src/lib/x402/facilitator.js";
import type { FacilitatorClient } from "@x402/core/server";

/**
 * The static-supported wrapper is what lets the resource server build a 402
 * without a network round-trip to the facilitator's /supported endpoint. It must
 * declare the (scheme, network) kind locally while still delegating verify/settle.
 */
describe("withStaticSupported", () => {
  const calls = { verify: 0, settle: 0 };
  const inner: FacilitatorClient = {
    async getSupported() {
      throw new Error("inner getSupported must NOT be called");
    },
    async verify() {
      calls.verify++;
      return { isValid: true, payer: "0xabc" };
    },
    async settle() {
      calls.settle++;
      return {
        success: true,
        transaction: "0xtx",
        network: "eip155:8453" as const,
        payer: "0xabc",
      };
    },
  };

  it("declares the exact/network kind statically without calling the inner client", async () => {
    const wrapped = withStaticSupported(inner, "eip155:8453");
    const supported = await wrapped.getSupported();
    expect(supported.kinds).toEqual([{ x402Version: 2, scheme: "exact", network: "eip155:8453" }]);
    expect(supported.extensions).toContain("bazaar");
  });

  it("delegates verify and settle to the wrapped client", async () => {
    const wrapped = withStaticSupported(inner, "eip155:8453");
    const reqs = {
      scheme: "exact",
      network: "eip155:8453" as const,
      asset: "0x0",
      amount: "10000",
      payTo: "0x0",
      maxTimeoutSeconds: 60,
      extra: {},
    };
    const payload = { x402Version: 2, accepted: reqs, payload: {} };
    await wrapped.verify(payload, reqs);
    await wrapped.settle(payload, reqs);
    expect(calls.verify).toBe(1);
    expect(calls.settle).toBe(1);
  });
});
