import type { RepoSnapshot } from "./snapshot.js";
import type { HealthFlag, SignalBreakdown } from "./types.js";

/**
 * Derive the notable-condition flags from the snapshot and the computed signal
 * breakdown. Flags are emitted in the canonical order declared by the
 * `HealthFlag` union in `types.ts` so the output is deterministic regardless of
 * the order conditions are checked here.
 */

/** Top-author share at or above this counts as a single-maintainer project. */
const SINGLE_MAINTAINER_SHARE = 0.9;
/** …or an effective contributor count at or below this. */
const SINGLE_MAINTAINER_EFFECTIVE = 1.2;
/** Days since last commit at or above this counts as stale. */
const STALE_DAYS = 365;

/** Canonical flag order (mirrors the `HealthFlag` union in types.ts). */
const FLAG_ORDER: readonly HealthFlag[] = [
  "ARCHIVED",
  "NO_LICENSE",
  "SINGLE_MAINTAINER",
  "NO_CI",
  "NO_TESTS",
  "NO_DESCRIPTION",
  "STALE",
  "NO_RELEASES",
  "FORK",
];

export function computeFlags(snapshot: RepoSnapshot, signals: SignalBreakdown): HealthFlag[] {
  const present = new Set<HealthFlag>();

  if (snapshot.meta.archived) present.add("ARCHIVED");
  if (snapshot.meta.fork) present.add("FORK");

  const hasDescription =
    snapshot.meta.description !== null && snapshot.meta.description.trim().length > 0;
  if (!hasDescription) present.add("NO_DESCRIPTION");

  if (signals.docs.hasLicense === false) present.add("NO_LICENSE");
  if (signals.ciPresence.hasCI === false) present.add("NO_CI");
  if (signals.testPresence.hasTests === false) present.add("NO_TESTS");

  if (signals.releaseCadence.totalReleases === 0) present.add("NO_RELEASES");

  const share = signals.busFactor.topAuthorShare;
  const effective = signals.busFactor.effectiveContributors;
  const singleByShare = typeof share === "number" && share >= SINGLE_MAINTAINER_SHARE;
  const singleByCount =
    typeof effective === "number" && effective > 0 && effective <= SINGLE_MAINTAINER_EFFECTIVE;
  if (singleByShare || singleByCount) present.add("SINGLE_MAINTAINER");

  const daysSinceCommit = signals.commitRecency.daysSinceLastCommit;
  if (typeof daysSinceCommit === "number" && daysSinceCommit >= STALE_DAYS) present.add("STALE");

  return FLAG_ORDER.filter((f) => present.has(f));
}
