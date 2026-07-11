import type { RepoSnapshot } from "../snapshot.js";
import type { SignalResult } from "../types.js";
import { detectCI } from "./_detect.js";

/**
 * ciPresence — is continuous integration configured?
 *
 * Rationale / curve:
 * CI is essentially a binary property of a repository: either automated checks
 * are wired up or they are not. We therefore score 100 when any recognised CI
 * configuration is present (GitHub Actions, GitLab CI, CircleCI, Travis, Azure
 * Pipelines, Jenkins, Drone, AppVeyor, Bitbucket) and 0 otherwise. The NO_CI
 * flag mirrors the false case.
 */
export function ciPresence(snapshot: RepoSnapshot): SignalResult {
  const hasCI = detectCI(snapshot.tree);
  return {
    score: hasCI ? 100 : 0,
    hasCI,
  };
}
