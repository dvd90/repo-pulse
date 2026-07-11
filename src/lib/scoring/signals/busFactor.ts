import type { RepoSnapshot } from "../snapshot.js";
import type { SignalResult } from "../types.js";
import { clamp, clampScore } from "./_util.js";

/**
 * busFactor — how concentrated is authorship? A project where one person wrote
 * everything is fragile.
 *
 * Rationale / curve:
 * We build a contribution distribution, preferring `contributors` (login →
 * contributions) and falling back to attributed commit authors when the
 * contributor list is empty. From it we derive:
 *   - topAuthorShare = largest share of total contributions.
 *   - effectiveContributors = inverse Herfindahl index `1 / Σ pᵢ²`, i.e. the
 *     "effective" number of equally-weighted contributors (1 for a solo repo,
 *     N for N equal contributors).
 * Score blends:
 *   - shareComponent: linear from share 0.2 → 100 down to share 0.8 → 0
 *     (dominance is penalised, broad participation rewarded). 60% weight.
 *   - effComponent: effectiveContributors scaled, saturating at 8 → 100.
 *     40% weight.
 *
 * Empty data: no contributor or author information → neutral-low 30 (we can't
 * confirm resilience, so we don't award it).
 */
const NO_DATA_SCORE = 30;

function distribution(snapshot: RepoSnapshot): number[] {
  const fromContributors = snapshot.contributors
    .map((c) => c.contributions)
    .filter((n) => Number.isFinite(n) && n > 0);
  if (fromContributors.length > 0) return fromContributors;

  // Fallback: count attributed commit authors.
  const counts = new Map<string, number>();
  for (const c of snapshot.commits) {
    if (c.authorLogin === null) continue;
    counts.set(c.authorLogin, (counts.get(c.authorLogin) ?? 0) + 1);
  }
  return [...counts.values()];
}

export function busFactor(snapshot: RepoSnapshot): SignalResult {
  const contribs = distribution(snapshot);
  const total = contribs.reduce((a, b) => a + b, 0);

  if (contribs.length === 0 || total === 0) {
    return {
      score: NO_DATA_SCORE,
      topAuthorShare: null,
      effectiveContributors: 0,
      contributorCount: contribs.length,
    };
  }

  const shares = contribs.map((n) => n / total);
  const topAuthorShare = Math.max(...shares);
  const hhi = shares.reduce((a, p) => a + p * p, 0);
  const effective = 1 / hhi;

  // share 0.2 → 100, share 0.8 → 0 (clamped outside that band).
  const shareComponent = clamp((0.8 - topAuthorShare) / 0.6, 0, 1) * 100;
  const effComponent = clamp(effective / 8, 0, 1) * 100;
  const score = clampScore(0.6 * shareComponent + 0.4 * effComponent);

  return {
    score,
    topAuthorShare: Math.round(topAuthorShare * 100) / 100,
    effectiveContributors: Math.round(effective * 10) / 10,
    contributorCount: contribs.length,
  };
}
