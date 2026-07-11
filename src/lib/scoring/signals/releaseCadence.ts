import type { RepoSnapshot } from "../snapshot.js";
import type { SignalResult } from "../types.js";
import { clamp, clampScore, daysBetween, decayScore } from "./_util.js";

/**
 * releaseCadence — regularity and recency of published releases.
 *
 * Rationale / curve:
 * We only count *published* releases (not drafts) that carry a `publishedAt`.
 * The score blends two halves:
 *   - recency: age of the most recent release, exponential decay with a 120-day
 *     half-life (a release in the last month scores ~100; ~4 months → ~50).
 *   - cadence: how many releases landed in the trailing 90 days. 0 → 0,
 *     1 → 40, 2 → 80, 3+ → 100 (linear at 40/release, capped).
 * Blended 50/50.
 *
 * Empty data: many perfectly healthy repos never cut formal releases, so the
 * absence of releases is only a *mild* negative — a defined floor of 25 rather
 * than 0. The NO_RELEASES flag surfaces the condition explicitly upstream.
 */
const NO_RELEASES_SCORE = 25;

export function releaseCadence(snapshot: RepoSnapshot): SignalResult {
  const published = snapshot.releases
    .filter((r) => !r.draft && r.publishedAt !== null)
    .map((r) => ({ ...r, publishedAt: r.publishedAt as string }));

  if (published.length === 0) {
    return {
      score: NO_RELEASES_SCORE,
      totalReleases: 0,
      releasesLast90Days: 0,
      daysSinceLastRelease: null,
    };
  }

  // Ages in days for each published release (explicit numeric handling).
  const ages: number[] = [];
  for (const r of published) {
    const d = daysBetween(r.publishedAt, snapshot.asOf);
    if (d !== null) ages.push(Math.max(0, d));
  }

  if (ages.length === 0) {
    // Present but all timestamps unparseable — treat as no usable data.
    return {
      score: NO_RELEASES_SCORE,
      totalReleases: published.length,
      releasesLast90Days: 0,
      daysSinceLastRelease: null,
    };
  }

  const daysSinceLast = Math.min(...ages);
  const releasesLast90 = ages.filter((a) => a <= 90).length;

  const recencyComponent = decayScore(daysSinceLast, 0, 120);
  const cadenceComponent = clamp(releasesLast90 * 40, 0, 100);
  const score = clampScore(0.5 * recencyComponent + 0.5 * cadenceComponent);

  return {
    score,
    totalReleases: published.length,
    releasesLast90Days: releasesLast90,
    daysSinceLastRelease: Math.round(daysSinceLast),
  };
}
