import type { SignalKey } from "./types.js";

/**
 * Signal weights — the single source of truth for how the composite health score
 * is assembled. Each signal produces a 0–100 sub-score; the composite is the
 * weighted average `sum(score_i * weight_i) / sum(weight_i)`, rounded to an
 * integer. Weights are relative (they need not sum to 1); we normalize by their
 * total so adding/removing a signal stays well-defined.
 *
 * Rationale for the emphasis:
 * - commitRecency & prFlow (activity/throughput) are the strongest liveness
 *   signals, so they carry the most weight.
 * - busFactor & testPresence capture project resilience and quality.
 * - ciPresence, issueHygiene, docs, depFreshness, releaseCadence round out
 *   maintenance discipline.
 *
 * Changing these is an intentional, reviewable act — bump SCHEMA_VERSION if the
 * change alters scores for a given repo state.
 */
export const WEIGHTS: Record<SignalKey, number> = {
  commitRecency: 20,
  releaseCadence: 8,
  issueHygiene: 10,
  prFlow: 16,
  busFactor: 12,
  ciPresence: 10,
  testPresence: 12,
  docs: 6,
  depFreshness: 6,
};

/** Sum of all weights, used to normalize the composite. */
export const WEIGHT_TOTAL: number = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
