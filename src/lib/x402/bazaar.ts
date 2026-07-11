import { declareDiscoveryExtension } from "@x402/extensions/bazaar";
import { HEALTH_RESPONSE_SCHEMA } from "../scoring/schema.js";

/**
 * Bazaar discovery extension for the paid `GET /v1/health` endpoint. This is
 * agent-facing SEO: facilitators index it so autonomous agents can discover the
 * service, understand exactly how to call it, and know precisely what they get
 * back. The input/output schemas below are written carefully with per-parameter
 * descriptions for that reason.
 *
 * `declareDiscoveryExtension` returns `{ bazaar: <extension> }`, which is
 * attached verbatim to the route config's `extensions` field.
 */
export const healthDiscoveryExtension = declareDiscoveryExtension({
  // `method` is intentionally omitted — the SDK's `DeclareDiscoveryExtensionInput`
  // excludes it and the resource-server extension fills it in from the route
  // (GET) during enrichment. Absence of `bodyType` marks this a query extension.
  //
  // Example input shown to discovering agents.
  input: { repo: "honojs/hono" },
  inputSchema: {
    type: "object",
    properties: {
      repo: {
        type: "string",
        description:
          "Public GitHub repository to score, in 'owner/name' form (e.g. 'honojs/hono'). Owner: 1–39 chars, alphanumeric or single hyphens. Name: 1–100 chars from [A-Za-z0-9._-]. Private repos are not supported.",
        pattern: "^[A-Za-z0-9-]{1,39}/[A-Za-z0-9._-]{1,100}$",
        examples: ["honojs/hono", "cloudflare/workers-sdk", "coinbase/x402"],
      },
    },
    required: ["repo"],
    additionalProperties: false,
  },
  output: {
    example: HEALTH_RESPONSE_SCHEMA.examples[0],
    schema: HEALTH_RESPONSE_SCHEMA as unknown as Record<string, unknown>,
  },
});
