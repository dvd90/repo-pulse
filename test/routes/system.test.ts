import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { createApp } from "../../src/app.js";

const app = createApp();

describe("system routes", () => {
  it("GET /healthz returns ok envelope with a callId", async () => {
    const res = await app.request("/healthz", {}, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; data: { status: string }; callId: string };
    expect(body.ok).toBe(true);
    expect(body.data.status).toBe("ok");
    expect(body.callId).toBeTruthy();
    expect(res.headers.get("x-call-id")).toBe(body.callId);
  });

  it("honors an incoming x-call-id", async () => {
    const res = await app.request("/healthz", { headers: { "x-call-id": "abc-123" } }, env);
    const body = (await res.json()) as { callId: string };
    expect(body.callId).toBe("abc-123");
    expect(res.headers.get("x-call-id")).toBe("abc-123");
  });

  it("GET /readyz reports KV and config checks", async () => {
    const res = await app.request("/readyz", {}, env);
    const body = (await res.json()) as {
      data: { ready: boolean; checks: Record<string, { ok: boolean } | undefined> };
    };
    // KV + config should pass in the test worker.
    expect(body.data.checks.kv?.ok).toBe(true);
    expect(body.data.checks.config?.ok).toBe(true);
  });

  it("unknown route returns structured 404", async () => {
    const res = await app.request("/nope", {}, env);
    expect(res.status).toBe(404);
    const body = (await res.json()) as { ok: boolean; error: { code: string } };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("not_found");
  });
});
