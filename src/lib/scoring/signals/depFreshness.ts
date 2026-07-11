import type { RepoSnapshot } from "../snapshot.js";
import type { SignalResult } from "../types.js";
import { clampScore } from "./_util.js";

/**
 * depFreshness — best-effort health of declared dependencies.
 *
 * Rationale / curve:
 * The snapshot exposes a manifest with `total` direct deps and how many are
 * `pinned` (wildcard-free). A high pinned ratio implies reproducible, managed
 * dependencies. We map the pinned ratio onto a floored range so that even a
 * fully-unpinned manifest is not catastrophic (it is a soft quality signal, not
 * a liveness signal):
 *   score = 40 + 60 * pinnedRatio   → 0% pinned → 40, 100% pinned → 100.
 *
 * Edge cases:
 *   - No manifest detected → neutral 50 (we have no dependency data at all; we
 *     neither reward nor punish, matching the "defined neutral" requirement).
 *   - Manifest with zero declared deps → 80 (nothing to go stale is low-risk).
 */
const NO_MANIFEST_SCORE = 50;
const ZERO_DEPS_SCORE = 80;

export function depFreshness(snapshot: RepoSnapshot): SignalResult {
  const deps = snapshot.dependencies;

  if (deps === null) {
    return {
      score: NO_MANIFEST_SCORE,
      manifest: null,
      total: 0,
      pinned: 0,
      pinnedRatio: null,
    };
  }

  if (deps.total <= 0) {
    return {
      score: ZERO_DEPS_SCORE,
      manifest: deps.manifest,
      total: 0,
      pinned: 0,
      pinnedRatio: null,
    };
  }

  const pinnedRatio = Math.min(1, Math.max(0, deps.pinned / deps.total));
  const score = clampScore(40 + 60 * pinnedRatio);

  return {
    score,
    manifest: deps.manifest,
    total: deps.total,
    pinned: deps.pinned,
    pinnedRatio: Math.round(pinnedRatio * 100) / 100,
  };
}
