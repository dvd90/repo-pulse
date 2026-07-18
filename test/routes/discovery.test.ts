import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { createApp } from "../../src/app.js";

const app = createApp();

interface WellKnownDoc {
  version: number;
  resources: string[];
}

describe("GET /.well-known/x402", () => {
  it("lists the paid resource with the request origin", async () => {
    const res = await app.request("https://example.com/.well-known/x402", {}, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as WellKnownDoc;
    expect(body.version).toBe(1);
    expect(body.resources).toEqual(["https://example.com/v1/health"]);
  });

  it("serves the same document at the .json alias", async () => {
    const canonical = await app.request("https://example.com/.well-known/x402", {}, env);
    const alias = await app.request("https://example.com/.well-known/x402.json", {}, env);
    expect(alias.status).toBe(200);
    expect(await alias.json()).toEqual(await canonical.json());
  });

  it("is raw spec JSON, not the app envelope", async () => {
    const res = await app.request("https://example.com/.well-known/x402", {}, env);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.ok).toBeUndefined();
    expect(body.callId).toBeUndefined();
  });
});

describe("GET /favicon.ico", () => {
  it("serves a valid ICO", async () => {
    const res = await app.request("https://example.com/favicon.ico", {}, env);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/x-icon");
    const bytes = new Uint8Array(await res.arrayBuffer());
    // ICO magic: reserved=0, type=1 (icon), count>=1.
    expect([bytes[0], bytes[1], bytes[2], bytes[3], bytes[4]]).toEqual([0, 0, 1, 0, 1]);
  });
});

describe("GET /openapi.json", () => {
  it("declares x402 payment info and a 402 response on the paid operation", async () => {
    const res = await app.request("https://example.com/openapi.json", {}, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      openapi: string;
      servers: { url: string }[];
      paths: Record<
        string,
        {
          get: {
            "x-payment-info"?: {
              protocols: string[];
              price: { mode: string; currency: string; amount: string };
            };
            responses: Record<string, unknown>;
          };
        }
      >;
      components: { schemas: Record<string, unknown> };
    };
    expect(body.openapi).toBe("3.1.0");
    expect(body.servers).toEqual([{ url: "https://example.com" }]);
    expect(
      (body as unknown as { info: { contact: { email: string } } }).info.contact.email,
    ).toBe("dvdsellam@gmail.com");

    const paid = body.paths["/v1/health"]!.get;
    expect(paid["x-payment-info"]?.protocols).toContain("x402");
    // Amount mirrors X402_PRICE_USD without the dollar sign.
    expect(paid["x-payment-info"]?.price).toEqual({
      mode: "fixed",
      currency: "USD",
      amount: "0.01",
    });
    expect(paid.responses["402"]).toBeDefined();
    expect(body.components.schemas.HealthReport).toBeDefined();

    // Free endpoints carry no payment info and opt out of x402 probing.
    for (const path of ["/v1/schema", "/healthz", "/readyz"]) {
      const op = body.paths[path]!.get as { "x-payment-info"?: unknown; security?: unknown[] };
      expect(op["x-payment-info"]).toBeUndefined();
      expect(op.security).toEqual([]);
    }
  });
});
