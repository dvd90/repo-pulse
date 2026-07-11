import { describe, it, expect } from "vitest";
import { issueHygiene } from "../../../src/lib/scoring/signals/issueHygiene.js";
import { baseSnapshot, daysAgo } from "./_helpers.js";
import type { SnapshotIssue } from "../../../src/lib/scoring/snapshot.js";

let n = 0;
function issue(state: "open" | "closed", createdDaysAgo: number, isPR = false): SnapshotIssue {
  return {
    number: ++n,
    state,
    createdAt: daysAgo(createdDaysAgo),
    closedAt: state === "closed" ? daysAgo(createdDaysAgo - 1) : null,
    isPullRequest: isPR,
    comments: 0,
  };
}

describe("issueHygiene", () => {
  it("returns a neutral 70 when there are no issues", () => {
    const r = issueHygiene(baseSnapshot({ issues: [] }));
    expect(r.score).toBe(70);
    expect(r.closeRatio).toBeNull();
  });

  it("excludes pull requests from the ratio", () => {
    const r = issueHygiene(
      baseSnapshot({ issues: [issue("open", 10, true), issue("closed", 10), issue("closed", 10)] }),
    );
    // Only the two real issues (both closed) count → ratio 1.
    expect(r.openIssues).toBe(0);
    expect(r.closedIssues).toBe(2);
    expect(r.closeRatio).toBe(1);
  });

  it("scores ~ closeRatio*100 with a fresh backlog", () => {
    const issues = [
      issue("closed", 10),
      issue("closed", 10),
      issue("closed", 10),
      issue("open", 5),
    ];
    const r = issueHygiene(baseSnapshot({ issues }));
    expect(r.closeRatio).toBe(0.75);
    expect(r.score).toBe(75);
  });

  it("penalizes a backlog of stale open issues", () => {
    const fresh = issueHygiene(
      baseSnapshot({ issues: [issue("closed", 10), issue("open", 5)] }),
    ).score;
    const stale = issueHygiene(
      baseSnapshot({ issues: [issue("closed", 10), issue("open", 400)] }),
    ).score;
    expect(stale).toBeLessThan(fresh);
  });

  it("never returns a value outside [0,100]", () => {
    const r = issueHygiene(baseSnapshot({ issues: [issue("open", 500), issue("open", 500)] }));
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });
});
