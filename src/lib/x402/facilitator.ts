import { HTTPFacilitatorClient } from "@x402/core/server";
import type { Config } from "../../env.js";
import type { Logger } from "../log.js";

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
