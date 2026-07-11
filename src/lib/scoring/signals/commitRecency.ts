import type { RepoSnapshot } from "../snapshot.js";
import type { SignalResult } from "../types.js";
import { clampScore, daysBetween, decayScore } from "./_util.js";

/**
 * commitRecency — how recently the default branch moved.
 *
 * Rationale / curve:
 * The single strongest liveness signal. We take the newest available commit
 * date (falling back to `meta.pushedAt` when the commit list is empty) and
 * measure its age against `asOf`. The curve gives full marks for anything
 * committed in the last week (normal quiet gaps shouldn't be punished), then
 * decays with a ~90-day half-life:
 *   - 0–7 days   → 100
 *   - ~30 days   → ~84
 *   - ~97 days   → 50
 *   - ~1 year    → ~6
 *   - ~2 years   → ~0
 * A repo with no commits and no push timestamp is treated as fully stale (0),
 * since there is no evidence of any activity.
 */
export function commitRecency(snapshot: RepoSnapshot): SignalResult {
  // The fetcher emits "" (not null) when a commit carries no date, so treat an
  // empty string as missing too — otherwise `"" ?? x` would keep the empty
  // sentinel and defeat the pushedAt fallback. Use the newest commit that
  // actually has a date.
  const newestCommitDate = snapshot.commits.find((c) => c.date)?.date ?? null;
  const referenceDate = newestCommitDate ?? snapshot.meta.pushedAt;

  const days = daysBetween(referenceDate, snapshot.asOf);

  if (days === null) {
    return {
      score: 0,
      daysSinceLastCommit: null,
      commitsAnalyzed: snapshot.commits.length,
      usedPushFallback: newestCommitDate === null,
    };
  }

  // Negative ages (event dated after asOf, e.g. clock skew) count as "just now".
  const age = Math.max(0, days);
  const score = clampScore(decayScore(age, 7, 90));

  return {
    score,
    daysSinceLastCommit: Math.round(age),
    commitsAnalyzed: snapshot.commits.length,
    usedPushFallback: newestCommitDate === null,
  };
}
