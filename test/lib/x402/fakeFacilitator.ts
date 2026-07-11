import type { FacilitatorClient } from "@x402/core/server";

/**
 * In-memory fake x402 facilitator for tests. Lets the 402 → pay → retry flow run
 * fully in workerd with no network and no real chain:
 * - `getSupported()` advertises `exact` on the configured network so the resource
 *   server will build valid payment requirements.
 * - `verify()` approves any well-formed payload.
 * - `settle()` reports a successful settlement with a canned tx hash.
 *
 * Records calls so tests can assert verify/settle actually happened.
 */
export interface FakeFacilitatorCalls {
  verify: number;
  settle: number;
  supported: number;
}

export function createFakeFacilitator(
  network: `${string}:${string}`,
  asset = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base
): { client: FacilitatorClient; calls: FakeFacilitatorCalls } {
  const calls: FakeFacilitatorCalls = { verify: 0, settle: 0, supported: 0 };

  const client: FacilitatorClient = {
    async getSupported() {
      calls.supported++;
      return {
        kinds: [
          {
            x402Version: 2,
            scheme: "exact",
            network,
            extra: { asset, decimals: 6 },
          },
        ],
        extensions: ["bazaar"],
        signers: {},
      };
    },
    async verify(payload) {
      calls.verify++;
      return { isValid: true, payer: (payload.payload?.["from"] as string) ?? "0xpayer" };
    },
    async settle(_payload, requirements) {
      calls.settle++;
      return {
        success: true,
        transaction: "0xtxhashfaketxhashfaketxhashfaketxhashfaketxhashfaketxhashfaketx01",
        network: requirements.network,
        payer: "0xpayer",
      };
    },
  };

  return { client, calls };
}
