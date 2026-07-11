import type { RepoSnapshot } from "./snapshot.js";
import type { HealthReport, SignalBreakdown, SignalKey } from "./types.js";
import { SCHEMA_VERSION, SIGNAL_KEYS } from "./types.js";
import { WEIGHTS, WEIGHT_TOTAL } from "./weights.js";
import { toGrade } from "./grade.js";
import { computeFlags } from "./flags.js";
import { buildSummary } from "./summary.js";

import { commitRecency } from "./signals/commitRecency.js";
import { releaseCadence } from "./signals/releaseCadence.js";
import { issueHygiene } from "./signals/issueHygiene.js";
import { prFlow } from "./signals/prFlow.js";
import { busFactor } from "./signals/busFactor.js";
import { ciPresence } from "./signals/ciPresence.js";
import { testPresence } from "./signals/testPresence.js";
import { docs } from "./signals/docs.js";
import { depFreshness } from "./signals/depFreshness.js";

/**
 * The nine signal calculators keyed by signal name. Building the breakdown by
 * iterating `SIGNAL_KEYS` guarantees the output object's key order matches the
 * canonical order every time.
 */
const CALCULATORS: Record<SignalKey, (snapshot: RepoSnapshot) => SignalBreakdown[SignalKey]> = {
  commitRecency,
  releaseCadence,
  issueHygiene,
  prFlow,
  busFactor,
  ciPresence,
  testPresence,
  docs,
  depFreshness,
};

/**
 * Score a snapshot into a fully-populated {@link HealthReport}. Pure and
 * deterministic: the same snapshot always yields a byte-identical report. All
 * recency math is relative to `snapshot.asOf`, and `generatedAt` echoes it.
 *
 * The composite is the weight-normalized average of the nine sub-scores,
 * `Σ(scoreᵢ · weightᵢ) / Σ weightᵢ`, rounded to an integer.
 */
export function scoreSnapshot(snapshot: RepoSnapshot): HealthReport {
  const signals = {} as SignalBreakdown;
  let weightedSum = 0;
  for (const key of SIGNAL_KEYS) {
    const result = CALCULATORS[key](snapshot);
    signals[key] = result;
    weightedSum += result.score * WEIGHTS[key];
  }

  const score = Math.round(weightedSum / WEIGHT_TOTAL);
  const grade = toGrade(score);
  const flags = computeFlags(snapshot, signals);
  const summary = buildSummary(snapshot, score, grade, signals, flags);

  return {
    schemaVersion: SCHEMA_VERSION,
    repo: snapshot.meta.fullName,
    score,
    grade,
    signals,
    weights: WEIGHTS,
    flags,
    summary,
    generatedAt: snapshot.asOf,
  };
}
