import { describe, it, expect } from "vitest";
import { scoreSnapshot } from "../../../src/lib/scoring/score.js";
import { SCHEMA_VERSION, SIGNAL_KEYS } from "../../../src/lib/scoring/types.js";
import { WEIGHTS, WEIGHT_TOTAL } from "../../../src/lib/scoring/weights.js";
import { toGrade } from "../../../src/lib/scoring/grade.js";
import { FIXTURES, healthyRepo, abandonedRepo, minimalRepo } from "../../fixtures/index.js";

/**
 * Golden-file tests: lock the exact, deterministic report for each fixture via
 * inline snapshots. If a scoring curve changes, these snapshots change and must
 * be reviewed intentionally (bump SCHEMA_VERSION when a curve moves).
 */

describe("scoreSnapshot — golden reports", () => {
  it("healthyRepo → grade A", () => {
    expect(scoreSnapshot(healthyRepo)).toMatchInlineSnapshot(`
      {
        "flags": [],
        "generatedAt": "2026-07-11T00:00:00.000Z",
        "grade": "A",
        "repo": "honojs/hono",
        "schemaVersion": "repopulse.v1",
        "score": 92,
        "signals": {
          "busFactor": {
            "contributorCount": 6,
            "effectiveContributors": 4.8,
            "score": 76,
            "topAuthorShare": 0.29,
          },
          "ciPresence": {
            "hasCI": true,
            "score": 100,
          },
          "commitRecency": {
            "commitsAnalyzed": 5,
            "daysSinceLastCommit": 1,
            "score": 100,
            "usedPushFallback": false,
          },
          "depFreshness": {
            "manifest": "package.json",
            "pinned": 8,
            "pinnedRatio": 0.8,
            "score": 88,
            "total": 10,
          },
          "docs": {
            "hasDescription": true,
            "hasDocsDir": true,
            "hasLicense": true,
            "hasReadme": true,
            "score": 100,
          },
          "issueHygiene": {
            "closeRatio": 0.75,
            "closedIssues": 9,
            "openIssues": 3,
            "score": 75,
            "staleOpenIssues": 0,
          },
          "prFlow": {
            "medianMergeHours": 24,
            "mergeRatio": 0.78,
            "mergedPulls": 7,
            "openPulls": 1,
            "resolvedPulls": 9,
            "score": 87,
          },
          "releaseCadence": {
            "daysSinceLastRelease": 10,
            "releasesLast90Days": 3,
            "score": 97,
            "totalReleases": 4,
          },
          "testPresence": {
            "hasTests": true,
            "score": 100,
          },
        },
        "summary": "Grade A (92/100): shows active development and an automated test suite.",
        "weights": {
          "busFactor": 12,
          "ciPresence": 10,
          "commitRecency": 20,
          "depFreshness": 6,
          "docs": 6,
          "issueHygiene": 10,
          "prFlow": 16,
          "releaseCadence": 8,
          "testPresence": 12,
        },
      }
    `);
  });

  it("abandonedRepo → grade F with flags", () => {
    expect(scoreSnapshot(abandonedRepo)).toMatchInlineSnapshot(`
      {
        "flags": [
          "NO_LICENSE",
          "SINGLE_MAINTAINER",
          "NO_CI",
          "NO_TESTS",
          "NO_DESCRIPTION",
          "STALE",
          "NO_RELEASES",
        ],
        "generatedAt": "2026-07-11T00:00:00.000Z",
        "grade": "F",
        "repo": "old/abandoned-lib",
        "schemaVersion": "repopulse.v1",
        "score": 12,
        "signals": {
          "busFactor": {
            "contributorCount": 1,
            "effectiveContributors": 1,
            "score": 5,
            "topAuthorShare": 1,
          },
          "ciPresence": {
            "hasCI": false,
            "score": 0,
          },
          "commitRecency": {
            "commitsAnalyzed": 3,
            "daysSinceLastCommit": 787,
            "score": 0,
            "usedPushFallback": false,
          },
          "depFreshness": {
            "manifest": null,
            "pinned": 0,
            "pinnedRatio": null,
            "score": 50,
            "total": 0,
          },
          "docs": {
            "hasDescription": false,
            "hasDocsDir": false,
            "hasLicense": false,
            "hasReadme": true,
            "score": 45,
          },
          "issueHygiene": {
            "closeRatio": 0.2,
            "closedIssues": 2,
            "openIssues": 8,
            "score": 0,
            "staleOpenIssues": 8,
          },
          "prFlow": {
            "medianMergeHours": null,
            "mergeRatio": 0,
            "mergedPulls": 0,
            "openPulls": 1,
            "resolvedPulls": 3,
            "score": 24,
          },
          "releaseCadence": {
            "daysSinceLastRelease": null,
            "releasesLast90Days": 0,
            "score": 25,
            "totalReleases": 0,
          },
          "testPresence": {
            "hasTests": false,
            "score": 0,
          },
        },
        "summary": "Grade F (12/100): held back by stalled development and no tests.",
        "weights": {
          "busFactor": 12,
          "ciPresence": 10,
          "commitRecency": 20,
          "depFreshness": 6,
          "docs": 6,
          "issueHygiene": 10,
          "prFlow": 16,
          "releaseCadence": 8,
          "testPresence": 12,
        },
      }
    `);
  });

  it("minimalRepo → sparse new repo", () => {
    expect(scoreSnapshot(minimalRepo)).toMatchInlineSnapshot(`
      {
        "flags": [
          "NO_CI",
          "NO_TESTS",
          "NO_RELEASES",
        ],
        "generatedAt": "2026-07-11T00:00:00.000Z",
        "grade": "D",
        "repo": "newdev/starter-kit",
        "schemaVersion": "repopulse.v1",
        "score": 50,
        "signals": {
          "busFactor": {
            "contributorCount": 2,
            "effectiveContributors": 1.9,
            "score": 27,
            "topAuthorShare": 0.63,
          },
          "ciPresence": {
            "hasCI": false,
            "score": 0,
          },
          "commitRecency": {
            "commitsAnalyzed": 3,
            "daysSinceLastCommit": 6,
            "score": 100,
            "usedPushFallback": false,
          },
          "depFreshness": {
            "manifest": "package.json",
            "pinned": 1,
            "pinnedRatio": 0.33,
            "score": 60,
            "total": 3,
          },
          "docs": {
            "hasDescription": true,
            "hasDocsDir": false,
            "hasLicense": true,
            "hasReadme": true,
            "score": 80,
          },
          "issueHygiene": {
            "closeRatio": null,
            "closedIssues": 0,
            "openIssues": 0,
            "score": 70,
            "staleOpenIssues": 0,
          },
          "prFlow": {
            "medianMergeHours": null,
            "mergeRatio": null,
            "mergedPulls": 0,
            "openPulls": 0,
            "resolvedPulls": 0,
            "score": 60,
          },
          "releaseCadence": {
            "daysSinceLastRelease": null,
            "releasesLast90Days": 0,
            "score": 25,
            "totalReleases": 0,
          },
          "testPresence": {
            "hasTests": false,
            "score": 0,
          },
        },
        "summary": "Grade D (50/100): shows active development and solid documentation, though held back by no tests and no CI.",
        "weights": {
          "busFactor": 12,
          "ciPresence": 10,
          "commitRecency": 20,
          "depFreshness": 6,
          "docs": 6,
          "issueHygiene": 10,
          "prFlow": 16,
          "releaseCadence": 8,
          "testPresence": 12,
        },
      }
    `);
  });
});

describe("scoreSnapshot — structural invariants", () => {
  for (const [name, snapshot] of Object.entries(FIXTURES)) {
    it(`${name}: report is well-formed and deterministic`, () => {
      const a = scoreSnapshot(snapshot);
      const b = scoreSnapshot(snapshot);
      // Byte-identical across runs.
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));

      expect(a.schemaVersion).toBe(SCHEMA_VERSION);
      expect(a.repo).toBe(snapshot.meta.fullName);
      expect(a.generatedAt).toBe(snapshot.asOf);
      expect(a.weights).toEqual(WEIGHTS);

      // Composite is the weight-normalized average, rounded.
      let weighted = 0;
      for (const key of SIGNAL_KEYS) {
        const s = a.signals[key].score;
        expect(Number.isInteger(s)).toBe(true);
        expect(s).toBeGreaterThanOrEqual(0);
        expect(s).toBeLessThanOrEqual(100);
        weighted += s * WEIGHTS[key];
      }
      expect(a.score).toBe(Math.round(weighted / WEIGHT_TOTAL));
      expect(Number.isInteger(a.score)).toBe(true);
      expect(a.grade).toBe(toGrade(a.score));

      // Signal keys present in canonical order.
      expect(Object.keys(a.signals)).toEqual([...SIGNAL_KEYS]);
    });
  }

  it("healthyRepo grades A, abandonedRepo grades F, minimalRepo grades D or below", () => {
    expect(scoreSnapshot(healthyRepo).grade).toBe("A");
    expect(scoreSnapshot(abandonedRepo).grade).toBe("F");
    expect(["C", "D", "F"]).toContain(scoreSnapshot(minimalRepo).grade);
  });
});
