import { describe, it, expect } from "vitest";
import { prFlow } from "../../../src/lib/scoring/signals/prFlow.js";
import { baseSnapshot, hoursAgo, daysAgo } from "./_helpers.js";
import type { SnapshotPull } from "../../../src/lib/scoring/snapshot.js";

let n = 0;
function merged(openHours: number): SnapshotPull {
  const created = hoursAgo(openHours + 1);
  const mergedAt = hoursAgo(1);
  return { number: ++n, state: "closed", createdAt: created, closedAt: mergedAt, mergedAt };
}
function closedUnmerged(): SnapshotPull {
  return {
    number: ++n,
    state: "closed",
    createdAt: daysAgo(10),
    closedAt: daysAgo(5),
    mergedAt: null,
  };
}
function open(): SnapshotPull {
  return { number: ++n, state: "open", createdAt: daysAgo(1), closedAt: null, mergedAt: null };
}

describe("prFlow", () => {
  it("returns a neutral 60 when there are no resolved PRs", () => {
    const r = prFlow(baseSnapshot({ pulls: [open(), open()] }));
    expect(r.score).toBe(60);
    expect(r.mergeRatio).toBeNull();
    expect(r.openPulls).toBe(2);
  });

  it("scores high for fast, mostly-merged PRs", () => {
    const r = prFlow(baseSnapshot({ pulls: [merged(4), merged(6), merged(10), merged(8)] }));
    expect(r.mergeRatio).toBe(1);
    expect(r.medianMergeHours).toBeLessThanOrEqual(24);
    expect(r.score).toBe(100);
  });

  it("penalizes low merge ratio", () => {
    const allMerged = prFlow(baseSnapshot({ pulls: [merged(5), merged(5)] })).score;
    const halfMerged = prFlow(
      baseSnapshot({ pulls: [merged(5), merged(5), closedUnmerged(), closedUnmerged()] }),
    ).score;
    expect(halfMerged).toBeLessThan(allMerged);
  });

  it("penalizes slow merges", () => {
    const fast = prFlow(baseSnapshot({ pulls: [merged(12)] })).score;
    const slow = prFlow(baseSnapshot({ pulls: [merged(24 * 30)] })).score;
    expect(slow).toBeLessThan(fast);
  });

  it("computes the median merge time deterministically", () => {
    const r = prFlow(baseSnapshot({ pulls: [merged(10), merged(20), merged(30)] }));
    expect(r.medianMergeHours).toBe(20);
  });
});
