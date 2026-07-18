import { Hono } from "hono";
import { HEALTH_RESPONSE_SCHEMA } from "../lib/scoring/schema.js";
import { parseEnv } from "../env.js";
import type { Context } from "hono";
import type { AppEnv } from "../types.js";

/**
 * Discovery endpoints consumed by x402 indexers (x402scan, crawlers): the
 * `/.well-known/x402` document enumerating paid resources, and an OpenAPI spec
 * with `x-payment-info` on the payable operation. These are external spec
 * formats read verbatim by machines, so they intentionally bypass the app's
 * `{ ok, data, callId }` envelope.
 *
 * x402scan's flow: fetch the well-known doc → probe each listed resource for a
 * spec-correct 402 (non-empty `accepts`, Bazaar extension) → optionally read
 * `/openapi.json` for operation metadata. The 402 itself is produced by the
 * payment middleware; these routes only make it findable.
 */
export const discoveryRoutes = new Hono<AppEnv>();

const origin = (c: Context<AppEnv>): string => new URL(c.req.url).origin;

const wellKnown = (c: Context<AppEnv>) =>
  c.json({
    version: 1,
    resources: [`${origin(c)}/v1/health`],
  });

// Both spellings are seen in the wild ("/.well-known/x402" in the spec,
// ".json" suffix in several indexers) — serve the same document at each.
discoveryRoutes.get("/.well-known/x402", wellKnown);
discoveryRoutes.get("/.well-known/x402.json", wellKnown);

discoveryRoutes.get("/openapi.json", (c) => {
  const priceUsd = parseEnv(c.env).X402_PRICE_USD.replace(/^\$/, "");
  return c.json({
    openapi: "3.1.0",
    info: {
      title: "RepoPulse",
      version: "1.0.0",
      description:
        "Deterministic 0-100 health score for any public GitHub repository, " +
        "with a nine-signal breakdown, A-F grade, flags, and a one-line summary. " +
        "Paid per call via x402 (USDC on Base); no account or API key.",
    },
    servers: [{ url: origin(c) }],
    paths: {
      "/v1/health": {
        get: {
          operationId: "getRepoHealth",
          summary: "Score a public GitHub repository (paid via x402)",
          "x-payment-info": {
            protocols: ["x402"],
            price: { mode: "fixed", currency: "USD", amount: priceUsd },
          },
          parameters: [
            {
              name: "repo",
              in: "query",
              required: true,
              description: "Repository as 'owner/name', e.g. 'honojs/hono'.",
              schema: {
                type: "string",
                pattern: "^[A-Za-z0-9-]{1,39}/[A-Za-z0-9._-]{1,100}$",
              },
            },
          ],
          responses: {
            "200": {
              description: "Health report",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean", const: true },
                      data: { $ref: "#/components/schemas/HealthReport" },
                      callId: { type: "string" },
                    },
                    required: ["ok", "data", "callId"],
                  },
                },
              },
            },
            "400": { description: "Malformed repo parameter" },
            "402": {
              description:
                "Payment required — x402 requirements in the PAYMENT-REQUIRED header " +
                "and response body (`accepts`). Pay and retry with PAYMENT-SIGNATURE.",
            },
          },
        },
      },
      "/v1/schema": {
        get: {
          operationId: "getSchema",
          summary: "Response JSON Schema + active signal weights (free)",
          responses: { "200": { description: "Schema and weights" } },
        },
      },
      "/healthz": {
        get: {
          operationId: "livez",
          summary: "Liveness (free)",
          responses: { "200": { description: "OK" } },
        },
      },
      "/readyz": {
        get: {
          operationId: "readyz",
          summary: "Readiness: config + KV + facilitator (free)",
          responses: { "200": { description: "Ready" } },
        },
      },
    },
    components: { schemas: { HealthReport: HEALTH_RESPONSE_SCHEMA } },
  });
});
