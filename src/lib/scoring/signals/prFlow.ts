import type { RepoSnapshot } from "../snapshot.js";
import type { SignalResult } from "../types.js";
import { clampScore, decayScore, hoursBetween, median } from "./_util.js";

/**
 * prFlow — pull-request throughput and responsiveness.
 *
 * Rationale / curve:
 * Among *resolved* PRs (state closed) we split merged vs. closed-unmerged.
 *   - mergeRatio = merged / resolved. A high merge rate means contributions
 *     actually land; scaled to 0–100 as the majority term (60%).
 *   - speed: median hours from open→merge for merged PRs. Fast review is a
 *     strong health sign. Decay with a 1-week half-life: ≤24h → 100,
 *     ~1 week → 50, ~1 month → ~5. Contributes 40%.
 *
 * Empty data: no resolved PRs → neutral 60 (absence of PR activity is weak
 * evidence either way; we neither reward nor heavily punish it).
 */
const NO_PR_SCORE = 60;

export function prFlow(snapshot: RepoSnapshot): SignalResult {
  const resolved = snapshot.pulls.filter((p) => p.state === "closed");

  if (resolved.length === 0) {
    return {
      score: NO_PR_SCORE,
      openPulls: snapshot.pulls.filter((p) => p.state === "open").length,
      mergedPulls: 0,
      resolvedPulls: 0,
      mergeRatio: null,
      medianMergeHours: null,
    };
  }

  const merged = resolved.filter((p) => p.mergedAt !== null);
  const mergeRatio = merged.length / resolved.length;

  const mergeHours: number[] = [];
  for (const p of merged) {
    const h = hoursBetween(p.createdAt, p.mergedAt);
    if (h !== null && h >= 0) mergeHours.push(h);
  }
  const medHours = median(mergeHours);

  const mergeComponent = mergeRatio * 100;
  const speedComponent = medHours === null ? 60 : decayScore(medHours, 24, 168);
  const score = clampScore(0.6 * mergeComponent + 0.4 * speedComponent);

  return {
    score,
    openPulls: snapshot.pulls.filter((p) => p.state === "open").length,
    mergedPulls: merged.length,
    resolvedPulls: resolved.length,
    mergeRatio: Math.round(mergeRatio * 100) / 100,
    medianMergeHours: medHours === null ? null : Math.round(medHours),
  };
}
