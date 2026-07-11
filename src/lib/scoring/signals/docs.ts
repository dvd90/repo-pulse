import type { RepoSnapshot } from "../snapshot.js";
import type { SignalResult } from "../types.js";
import { clampScore } from "./_util.js";
import { detectDocsDir, detectLicenseFile, detectReadme } from "./_detect.js";

/**
 * docs — documentation and discoverability.
 *
 * Rationale / curve:
 * Additive scoring across four independent, weighted facets that together sum
 * to 100. A README is the single most important artifact for a consumer, so it
 * carries the most weight; a license and a docs/ directory are strong signals
 * of a maintained, adoptable project; a repo description is a smaller nicety.
 *   - README present        → 45
 *   - LICENSE (meta or file) → 25
 *   - docs/ directory        → 20
 *   - repo description       → 10
 */
const README_POINTS = 45;
const LICENSE_POINTS = 25;
const DOCS_DIR_POINTS = 20;
const DESCRIPTION_POINTS = 10;

export function docs(snapshot: RepoSnapshot): SignalResult {
  const hasReadme = detectReadme(snapshot.tree);
  const hasDocsDir = detectDocsDir(snapshot.tree);
  const hasLicense = snapshot.meta.license !== null || detectLicenseFile(snapshot.tree);
  const hasDescription =
    snapshot.meta.description !== null && snapshot.meta.description.trim().length > 0;

  const score = clampScore(
    (hasReadme ? README_POINTS : 0) +
      (hasLicense ? LICENSE_POINTS : 0) +
      (hasDocsDir ? DOCS_DIR_POINTS : 0) +
      (hasDescription ? DESCRIPTION_POINTS : 0),
  );

  return {
    score,
    hasReadme,
    hasDocsDir,
    hasLicense,
    hasDescription,
  };
}
