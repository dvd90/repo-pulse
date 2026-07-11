import { describe, it, expect } from "vitest";
import { releaseCadence } from "../../../src/lib/scoring/signals/releaseCadence.js";
import { baseSnapshot, daysAgo } from "./_helpers.js";
import type { SnapshotRelease } from "../../../src/lib/scoring/snapshot.js";

function rel(days: number, extra: Partial<SnapshotRelease> = {}): SnapshotRelease {
  return {
    tagName: `v-${days}`,
    publishedAt: daysAgo(days),
    draft: false,
    prerelease: false,
    ...extra,
  };
}

describe("releaseCadence", () => {
  it("gives a defined low floor when there are no releases", () => {
    const r = releaseCadence(baseSnapshot({ releases: [] }));
    expect(r.score).toBe(25);
    expect(r.totalReleases).toBe(0);
    expect(r.daysSinceLastRelease).toBeNull();
  });

  it("ignores drafts and releases without a publish date", () => {
    const r = releaseCadence(
      baseSnapshot({
        releases: [
          rel(5, { draft: true }),
          { tagName: "x", publishedAt: null, draft: false, prerelease: false },
        ],
      }),
    );
    expect(r.totalReleases).toBe(0);
    expect(r.score).toBe(25);
  });

  it("scores high for a steady, recent cadence", () => {
    const r = releaseCadence(baseSnapshot({ releases: [rel(10), rel(45), rel(80)] }));
    expect(r.releasesLast90Days).toBe(3);
    expect(r.daysSinceLastRelease).toBe(10);
    expect(r.score).toBeGreaterThanOrEqual(90);
  });

  it("scores lower for a single old release", () => {
    const r = releaseCadence(baseSnapshot({ releases: [rel(400)] }));
    expect(r.releasesLast90Days).toBe(0);
    expect(r.score).toBeLessThan(30);
  });

  it("more recent releases never score worse than fewer/older ones", () => {
    const few = releaseCadence(baseSnapshot({ releases: [rel(60)] })).score;
    const many = releaseCadence(baseSnapshot({ releases: [rel(10), rel(40), rel(70)] })).score;
    expect(many).toBeGreaterThanOrEqual(few);
  });
});
