import { describe, it, expect } from "vitest";
import { busFactor } from "../../../src/lib/scoring/signals/busFactor.js";
import { baseSnapshot } from "./_helpers.js";
import type { SnapshotContributor } from "../../../src/lib/scoring/snapshot.js";

function contribs(...counts: number[]): SnapshotContributor[] {
  return counts.map((c, i) => ({ login: `dev${i}`, contributions: c }));
}

describe("busFactor", () => {
  it("returns a neutral-low 30 with no contributor or author data", () => {
    const r = busFactor(baseSnapshot({ contributors: [], commits: [] }));
    expect(r.score).toBe(30);
    expect(r.topAuthorShare).toBeNull();
    expect(r.effectiveContributors).toBe(0);
  });

  it("scores low for a single dominant maintainer", () => {
    const r = busFactor(baseSnapshot({ contributors: contribs(500) }));
    expect(r.topAuthorShare).toBe(1);
    expect(r.effectiveContributors).toBe(1);
    expect(r.score).toBeLessThan(20);
  });

  it("scores high for a broad, even contributor base", () => {
    const r = busFactor(
      baseSnapshot({ contributors: contribs(100, 100, 100, 100, 100, 100, 100, 100) }),
    );
    expect(r.topAuthorShare).toBeLessThanOrEqual(0.2);
    expect(r.score).toBeGreaterThanOrEqual(90);
  });

  it("more even distribution scores higher than a skewed one", () => {
    const even = busFactor(baseSnapshot({ contributors: contribs(100, 100, 100, 100) })).score;
    const skewed = busFactor(baseSnapshot({ contributors: contribs(370, 10, 10, 10) })).score;
    expect(even).toBeGreaterThan(skewed);
  });

  it("falls back to commit authors when contributors are empty", () => {
    const r = busFactor(
      baseSnapshot({
        contributors: [],
        commits: [
          { date: "2026-01-01T00:00:00.000Z", authorLogin: "a" },
          { date: "2026-01-02T00:00:00.000Z", authorLogin: "b" },
          { date: "2026-01-03T00:00:00.000Z", authorLogin: "a" },
        ],
      }),
    );
    expect(r.contributorCount).toBe(2);
    expect(r.topAuthorShare).toBeCloseTo(0.67, 1);
  });
});
