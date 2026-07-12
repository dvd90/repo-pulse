import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { createApp } from "../../src/app.js";

const app = createApp();

describe("GET / (landing page)", () => {
  it("serves self-contained HTML with the price and key links", async () => {
    const res = await app.request("/", {}, env);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const html = await res.text();
    expect(html).toContain("RepoPulse");
    expect(html).toContain("$0.01");
    expect(html).toContain("/v1/schema");
    // No external asset references (self-contained for the edge).
    expect(html).not.toMatch(/<script\s+src=/i);
    expect(html).not.toMatch(/<link[^>]+href="https?:/i);
  });
});
