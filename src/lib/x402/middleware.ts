import type { MiddlewareHandler } from "hono";
import { paymentMiddleware, x402ResourceServer } from "@x402/hono";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { bazaarResourceServerExtension } from "@x402/extensions/bazaar";
import type { FacilitatorClient } from "@x402/core/server";
import type { Config } from "../../env.js";
import type { Logger } from "../log.js";
import { buildFacilitatorClient } from "./facilitator.js";
import { healthDiscoveryExtension } from "./bazaar.js";

/** CAIP-2 network id, typed to satisfy the SDK's `Network` template type. */
type Caip2 = `${string}:${string}`;

export interface PaymentMiddlewareOptions {
  /** Inject a facilitator client (tests use a fake); defaults to CDP/HTTP. */
  facilitatorClient?: FacilitatorClient;
  log?: Logger;
  /** Whether to sync supported kinds from the facilitator on start. */
  syncFacilitatorOnStart?: boolean;
}

/**
 * Build the x402 payment middleware guarding `GET /v1/health`.
 *
 * - Price: `X402_PRICE_USD` ($0.01), scheme `exact`, network `X402_NETWORK`
 *   (Base mainnet `eip155:8453`), payTo `WALLET_ADDRESS`.
 * - Facilitator: Coinbase CDP (or an injected fake in tests).
 * - Bazaar discovery is enabled by attaching `healthDiscoveryExtension` to the
 *   route and registering `bazaarResourceServerExtension` on the server, so the
 *   endpoint is indexable with full input/output schemas.
 *
 * An unpaid request yields a spec-correct 402 with payment requirements; a paid
 * retry with a valid `PAYMENT-SIGNATURE` proceeds to the handler and settles.
 */
export function buildPaymentMiddleware(
  config: Config,
  opts: PaymentMiddlewareOptions = {},
): MiddlewareHandler {
  const facilitator = opts.facilitatorClient ?? buildFacilitatorClient(config, opts.log);
  const network = config.X402_NETWORK as Caip2;

  const server = new x402ResourceServer(facilitator)
    .register(network, new ExactEvmScheme())
    .registerExtension(bazaarResourceServerExtension);

  return paymentMiddleware(
    {
      "GET /v1/health": {
        accepts: {
          scheme: "exact",
          price: config.X402_PRICE_USD,
          network,
          payTo: config.WALLET_ADDRESS,
          maxTimeoutSeconds: 60,
        },
        description: config.SERVICE_DESCRIPTION,
        mimeType: "application/json",
        serviceName: config.SERVICE_NAME,
        tags: ["github", "developer-tools", "code-quality", "repository", "health", "analytics"],
        // { bazaar: <discovery extension> }
        extensions: healthDiscoveryExtension,
      },
    },
    server,
    undefined,
    undefined,
    opts.syncFacilitatorOnStart ?? false,
  );
}
