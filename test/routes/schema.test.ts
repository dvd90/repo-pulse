import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { createApp } from "../../src/app.js";
import { SIGNAL_KEYS } from "../../src/lib/scoring/types.js";

const app = createApp();

describe("GET /v1/schema", () => {
  it("returns the versioned schema, weights, and all signal keys", async () => {
    const res = await app.request("/v1/schema", {}, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: {
        schemaVersion: string;
        weights: Record<string, number>;
        schema: { properties: { signals: { properties: Record<string, unknown> } } };
      };
    };
    expect(body.data.schemaVersion).toBe("repopulse.v1");
    for (const key of SIGNAL_KEYS) {
      expect(body.data.weights[key]).toBeTypeOf("number");
      expect(body.data.schema.properties.signals.properties[key]).toBeDefined();
    }
  });
});
