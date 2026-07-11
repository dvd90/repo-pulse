import { describe, it, expect } from "vitest";
import { scoreSnapshot } from "../../../src/lib/scoring/score.js";
import { computeFlags } from "../../../src/lib/scoring/flags.js";
import { baseSnapshot, daysAgo } from "./_helpers.js";
import { healthyRepo, abandonedRepo, minimalRepo } from "../../fixtures/index.js";

describe("computeFlags", () => {
  it("healthy repo raises no flags", () => {
    expect(scoreSnapshot(healthyRepo).flags).toEqual([]);
  });

  it("abandoned repo raises the neglect flags in canonical order", () => {
    expect(scoreSnapshot(abandonedRepo).flags).toEqual([
      "NO_LICENSE",
      "SINGLE_MAINTAINER",
      "NO_CI",
      "NO_TESTS",
      "NO_DESCRIPTION",
      "STALE",
      "NO_RELEASES",
    ]);
  });

  it("minimal repo flags only the genuinely missing pieces", () => {
    expect(scoreSnapshot(minimalRepo).flags).toEqual(["NO_CI", "NO_TESTS", "NO_RELEASES"]);
  });

  it("emits ARCHIVED and FORK from metadata", () => {
    const snap = baseSnapshot({
      meta: { archived: true, fork: true },
      commits: [{ date: daysAgo(1), authorLogin: "a" }],
      contributors: [
        { login: "a", contributions: 10 },
        { login: "b", contributions: 10 },
      ],
      tree: [
        { path: ".github/workflows/ci.yml", type: "blob" },
        { path: "test/a.test.ts", type: "blob" },
      ],
      releases: [{ tagName: "v1", publishedAt: daysAgo(5), draft: false, prerelease: false }],
    });
    const report = scoreSnapshot(snap);
    expect(report.flags).toContain("ARCHIVED");
    expect(report.flags).toContain("FORK");
    // Canonical order: ARCHIVED precedes FORK.
    expect(report.flags.indexOf("ARCHIVED")).toBeLessThan(report.flags.indexOf("FORK"));
  });

  it("is a pure function of snapshot + signals", () => {
    const report = scoreSnapshot(abandonedRepo);
    const again = computeFlags(abandonedRepo, report.signals);
    expect(again).toEqual(report.flags);
  });
});
