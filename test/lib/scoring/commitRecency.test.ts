import { describe, it, expect } from "vitest";
import { commitRecency } from "../../../src/lib/scoring/signals/commitRecency.js";
import { baseSnapshot, daysAgo } from "./_helpers.js";

describe("commitRecency", () => {
  it("scores 100 for a commit today", () => {
    const r = commitRecency(baseSnapshot({ commits: [{ date: daysAgo(0), authorLogin: "a" }] }));
    expect(r.score).toBe(100);
    expect(r.daysSinceLastCommit).toBe(0);
  });

  it("still 100 within the 7-day grace window", () => {
    expect(
      commitRecency(baseSnapshot({ commits: [{ date: daysAgo(7), authorLogin: "a" }] })).score,
    ).toBe(100);
  });

  it("decays to ~50 near one half-life past the grace window", () => {
    const r = commitRecency(baseSnapshot({ commits: [{ date: daysAgo(97), authorLogin: "a" }] }));
    expect(r.score).toBeGreaterThanOrEqual(45);
    expect(r.score).toBeLessThanOrEqual(55);
  });

  it("is near zero for a two-year-old commit", () => {
    const r = commitRecency(baseSnapshot({ commits: [{ date: daysAgo(730), authorLogin: "a" }] }));
    expect(r.score).toBeLessThanOrEqual(2);
  });

  it("is monotonically non-increasing as the commit ages", () => {
    const ages = [0, 7, 30, 90, 180, 365, 730];
    const scores = ages.map(
      (d) =>
        commitRecency(baseSnapshot({ commits: [{ date: daysAgo(d), authorLogin: "a" }] })).score,
    );
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1] as number);
    }
  });

  it("falls back to pushedAt when there are no commits", () => {
    const r = commitRecency(baseSnapshot({ commits: [], meta: { pushedAt: daysAgo(3) } }));
    expect(r.score).toBe(100);
    expect(r.usedPushFallback).toBe(true);
  });

  it("scores 0 when neither commits nor pushedAt are available", () => {
    const r = commitRecency(baseSnapshot({ commits: [] }));
    expect(r.score).toBe(0);
    expect(r.daysSinceLastCommit).toBeNull();
  });

  it("treats an empty-string commit date as missing and falls back to pushedAt", () => {
    // The fetcher emits "" when a commit has no date; that must not defeat the
    // pushedAt fallback (regression: `"" ?? x` kept the empty sentinel).
    const r = commitRecency(
      baseSnapshot({ commits: [{ date: "", authorLogin: null }], meta: { pushedAt: daysAgo(2) } }),
    );
    expect(r.score).toBe(100);
    expect(r.usedPushFallback).toBe(true);
  });

  it("skips a dateless newest commit and uses the next dated commit", () => {
    const r = commitRecency(
      baseSnapshot({
        commits: [
          { date: "", authorLogin: null },
          { date: daysAgo(0), authorLogin: "a" },
        ],
      }),
    );
    expect(r.score).toBe(100);
    expect(r.usedPushFallback).toBe(false);
  });
});
