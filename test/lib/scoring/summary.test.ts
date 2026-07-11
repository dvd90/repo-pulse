import { describe, it, expect } from "vitest";
import { scoreSnapshot } from "../../../src/lib/scoring/score.js";
import { buildSummary } from "../../../src/lib/scoring/summary.js";
import { baseSnapshot, daysAgo } from "./_helpers.js";
import { healthyRepo, abandonedRepo } from "../../fixtures/index.js";

describe("buildSummary", () => {
  it("mentions the grade and score", () => {
    const r = scoreSnapshot(healthyRepo);
    expect(r.summary.startsWith(`Grade ${r.grade} (${r.score}/100)`)).toBe(true);
  });

  it("highlights strengths for a healthy repo", () => {
    const r = scoreSnapshot(healthyRepo);
    expect(r.summary).toContain("shows");
  });

  it("short-circuits to an archived sentence when archived", () => {
    const snap = baseSnapshot({
      meta: { archived: true },
      commits: [{ date: daysAgo(1), authorLogin: "a" }],
    });
    const r = scoreSnapshot(snap);
    expect(r.summary).toBe(
      `Grade ${r.grade} (${r.score}/100): archived and no longer actively maintained.`,
    );
  });

  it("names weaknesses for a struggling repo", () => {
    const r = scoreSnapshot(abandonedRepo);
    expect(r.summary).toContain("held back by");
  });

  it("is deterministic for identical inputs", () => {
    const r = scoreSnapshot(healthyRepo);
    const again = buildSummary(healthyRepo, r.score, r.grade, r.signals, r.flags);
    expect(again).toBe(r.summary);
  });
});
