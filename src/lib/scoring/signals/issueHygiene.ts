import type { RepoSnapshot } from "../snapshot.js";
import type { SignalResult } from "../types.js";
import { clampScore, daysBetween } from "./_util.js";

/**
 * issueHygiene — are issues being triaged and closed?
 *
 * Rationale / curve:
 * From the sampled issues (pull requests excluded) we compute the close ratio
 * `closed / (open + closed)`, which is the dominant term (scaled to 0–100).
 * We then apply a staleness penalty: up to 20 points off, proportional to the
 * fraction of *open* issues older than 180 days — a big backlog of ancient open
 * issues signals poor hygiene even when the close ratio looks fine.
 *
 * Empty data: a repo with no sampled issues gets a neutral 70 (an empty issue
 * tracker is not evidence of neglect — it is common for small or new repos).
 */
const NO_ISSUES_SCORE = 70;
const STALE_OPEN_DAYS = 180;
const MAX_STALE_PENALTY = 20;

export function issueHygiene(snapshot: RepoSnapshot): SignalResult {
  const issues = snapshot.issues.filter((i) => !i.isPullRequest);

  if (issues.length === 0) {
    return {
      score: NO_ISSUES_SCORE,
      openIssues: 0,
      closedIssues: 0,
      closeRatio: null,
      staleOpenIssues: 0,
    };
  }

  const open = issues.filter((i) => i.state === "open");
  const closed = issues.filter((i) => i.state === "closed");
  const closeRatio = closed.length / issues.length;

  const staleOpen = open.filter((i) => {
    const age = daysBetween(i.createdAt, snapshot.asOf);
    return age !== null && age >= STALE_OPEN_DAYS;
  }).length;
  const staleFraction = open.length === 0 ? 0 : staleOpen / open.length;

  const base = closeRatio * 100;
  const score = clampScore(base - MAX_STALE_PENALTY * staleFraction);

  return {
    score,
    openIssues: open.length,
    closedIssues: closed.length,
    closeRatio: Math.round(closeRatio * 100) / 100,
    staleOpenIssues: staleOpen,
  };
}
