import { HTTPFacilitatorClient } from "@x402/core/server";
import type { FacilitatorClient } from "@x402/core/server";
import type { Config } from "../../env.js";
import type { Logger } from "../log.js";

type Caip2 = `${string}:${string}`;

/**
 * Wrap a facilitator client so its `getSupported()` returns a fixed set of kinds
 * instead of calling the facilitator over the network.
 *
 * Why: the resource server can only build a 402 after it knows the facilitator
 * supports (scheme, network). The stock path fetches that with a network call to
 * the facilitator's `/supported` endpoint on first request — which, on Cloudflare
 * Workers, adds a cold-start round-trip and hard-fails the endpoint if the
 * facilitator is briefly unreachable or the CDP `/supported` auth hiccups.
 *
 * The (scheme=exact, network=Base) pair is a fixed property of this deployment,
 * not something we need to discover at runtime, so we declare it statically and
 * still delegate the real work — `verify` and `settle` — to the wrapped client.
 * This makes 402 generation self-contained and deterministic; only settlement
 * needs the network.
 */
export function withStaticSupported(
  client: FacilitatorClient,
  network: Caip2,
  scheme = "exact",
): FacilitatorClient {
  return {
    async getSupported() {
      return {
        kinds: [{ x402Version: 2, scheme, network }],
        // Advertise the bazaar discovery extension (CDP supports it) so the
        // server keeps the route's discovery info in the 402.
        extensions: ["bazaar"],
        signers: {},
      };
    },
    verify: (payload, requirements) => client.verify(payload, requirements),
    settle: (payload, requirements) => client.settle(payload, requirements),
  };
}

/**
 * Build the facilitator client for verify/settle. In production this is the
 * Coinbase CDP facilitator, authenticated per-request with a short-lived JWT
 * minted from the CDP API key (`@coinbase/cdp-sdk/auth`). Tests inject a fake
 * `FacilitatorClient` instead (see `test/lib/x402/fakeFacilitator.ts`), so no
 * real credentials or network are needed offline.
 */
export function buildFacilitatorClient(config: Config, log?: Logger): HTTPFacilitatorClient {
  const url = config.X402_FACILITATOR_URL;
  const isCdp = url.includes("api.cdp.coinbase.com");

  if (!isCdp) {
    // Public/testnet facilitator (e.g. https://x402.org/facilitator) — no auth.
    return new HTTPFacilitatorClient({ url });
  }

  const keyId = config.CDP_API_KEY_ID;
  const keySecret = config.CDP_API_KEY_SECRET;
  if (!keyId || !keySecret) {
    log?.warn("cdp_facilitator_missing_keys", {
      detail: "CDP_API_KEY_ID / CDP_API_KEY_SECRET not set; verify/settle will 401",
    });
  }

  const host = new URL(url).host; // api.cdp.coinbase.com
  const basePath = new URL(url).pathname.replace(/\/$/, ""); // /platform/v2/x402

  return new HTTPFacilitatorClient({
    url,
    createAuthHeaders: async () => {
      if (!keyId || !keySecret) {
        return { verify: {}, settle: {}, supported: {}, bazaar: {} };
      }
      // Dynamic import so the CDP SDK only loads when actually contacting CDP.
      const { generateJwt } = await import("@coinbase/cdp-sdk/auth");
      const bearer = async (method: "GET" | "POST", path: string) => {
        const jwt = await generateJwt({
          apiKeyId: keyId,
          apiKeySecret: keySecret,
          requestMethod: method,
          requestHost: host,
          requestPath: `${basePath}${path}`,
          expiresIn: 120,
        });
        return { Authorization: `Bearer ${jwt}` };
      };
      const [verify, settle, supported, bazaar] = await Promise.all([
        bearer("POST", "/verify"),
        bearer("POST", "/settle"),
        bearer("GET", "/supported"),
        bearer("GET", "/discovery/resources"),
      ]);
      return { verify, settle, supported, bazaar };
    },
  });
}
