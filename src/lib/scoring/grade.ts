import type { Grade } from "./types.js";

/**
 * Map a 0–100 composite score to a letter grade. Thresholds are fixed and
 * documented so the mapping is deterministic and stable.
 */
export function toGrade(score: number): Grade {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 40) return "D";
  return "F";
}
