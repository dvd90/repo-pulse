import { Hono } from "hono";
import { HEALTH_RESPONSE_SCHEMA } from "../lib/scoring/schema.js";
import { WEIGHTS } from "../lib/scoring/weights.js";
import { SCHEMA_VERSION } from "../lib/scoring/types.js";
import { ok } from "../lib/response.js";
import type { AppEnv } from "../types.js";

/** Free endpoint: returns the response JSON Schema and the active weights. */
export const schemaRoutes = new Hono<AppEnv>();

schemaRoutes.get("/v1/schema", (c) =>
  ok(c, {
    schemaVersion: SCHEMA_VERSION,
    weights: WEIGHTS,
    schema: HEALTH_RESPONSE_SCHEMA,
  }),
);
