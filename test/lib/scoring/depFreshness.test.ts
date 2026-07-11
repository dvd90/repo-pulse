import { describe, it, expect } from "vitest";
import { depFreshness } from "../../../src/lib/scoring/signals/depFreshness.js";
import { baseSnapshot } from "./_helpers.js";

describe("depFreshness", () => {
  it("returns a defined neutral 50 when no manifest was found", () => {
    const r = depFreshness(baseSnapshot({ dependencies: null }));
    expect(r.score).toBe(50);
    expect(r.manifest).toBeNull();
    expect(r.pinnedRatio).toBeNull();
  });

  it("returns 80 for a manifest with zero declared dependencies", () => {
    const r = depFreshness(
      baseSnapshot({ dependencies: { manifest: "package.json", total: 0, pinned: 0 } }),
    );
    expect(r.score).toBe(80);
  });

  it("maps pinned ratio onto [40,100]", () => {
    const none = depFreshness(
      baseSnapshot({ dependencies: { manifest: "x", total: 10, pinned: 0 } }),
    );
    const all = depFreshness(
      baseSnapshot({ dependencies: { manifest: "x", total: 10, pinned: 10 } }),
    );
    const most = depFreshness(
      baseSnapshot({ dependencies: { manifest: "x", total: 10, pinned: 8 } }),
    );
    expect(none.score).toBe(40);
    expect(all.score).toBe(100);
    expect(most.score).toBe(88);
    expect(most.pinnedRatio).toBe(0.8);
  });

  it("clamps a malformed manifest where pinned exceeds total", () => {
    const r = depFreshness(baseSnapshot({ dependencies: { manifest: "x", total: 4, pinned: 9 } }));
    expect(r.score).toBe(100);
    expect(r.pinnedRatio).toBe(1);
  });
});
