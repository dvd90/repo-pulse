import type { RepoSnapshot } from "./snapshot.js";
import type { Grade, HealthFlag, SignalBreakdown, SignalKey } from "./types.js";
import { SIGNAL_KEYS } from "./types.js";
import { WEIGHTS } from "./weights.js";

/**
 * Build the one-sentence, deterministic health summary. No LLM: it is a pure
 * template driven by the grade, the score, and the highest/lowest-scoring
 * signals. Given identical inputs it always produces byte-identical output.
 *
 * Strengths = signals scoring ≥ 80; weaknesses = signals scoring ≤ 45. Each set
 * is ranked (strengths by score desc, weaknesses by score asc), breaking ties by
 * signal weight then canonical key order, and capped at the two most notable.
 */

const STRENGTH_THRESHOLD = 80;
const WEAKNESS_THRESHOLD = 45;

const STRENGTH_PHRASE: Record<SignalKey, string> = {
  commitRecency: "active development",
  releaseCadence: "a steady release cadence",
  issueHygiene: "well-managed issues",
  prFlow: "a smooth pull-request flow",
  busFactor: "a broad contributor base",
  ciPresence: "CI in place",
  testPresence: "an automated test suite",
  docs: "solid documentation",
  depFreshness: "well-managed dependencies",
};

const WEAKNESS_PHRASE: Record<SignalKey, string> = {
  commitRecency: "stalled development",
  releaseCadence: "infrequent releases",
  issueHygiene: "a neglected issue backlog",
  prFlow: "a sluggish pull-request flow",
  busFactor: "reliance on a single maintainer",
  ciPresence: "no CI",
  testPresence: "no tests",
  docs: "thin documentation",
  depFreshness: "unpinned dependencies",
};

function rank(
  signals: SignalBreakdown,
  predicate: (score: number) => boolean,
  compare: (a: number, b: number) => number,
): SignalKey[] {
  return SIGNAL_KEYS.filter((k) => predicate(signals[k].score))
    .sort((a, b) => {
      const byScore = compare(signals[a].score, signals[b].score);
      if (byScore !== 0) return byScore;
      const byWeight = WEIGHTS[b] - WEIGHTS[a];
      if (byWeight !== 0) return byWeight;
      return SIGNAL_KEYS.indexOf(a) - SIGNAL_KEYS.indexOf(b);
    })
    .slice(0, 2);
}

function joinPhrases(keys: SignalKey[], table: Record<SignalKey, string>): string {
  const phrases = keys.map((k) => table[k]);
  if (phrases.length === 1) return phrases[0] as string;
  return `${phrases[0]} and ${phrases[1]}`;
}

export function buildSummary(
  _snapshot: RepoSnapshot,
  score: number,
  grade: Grade,
  signals: SignalBreakdown,
  flags: HealthFlag[],
): string {
  const base = `Grade ${grade} (${score}/100)`;

  if (flags.includes("ARCHIVED")) {
    return `${base}: archived and no longer actively maintained.`;
  }

  const strengths = rank(
    signals,
    (s) => s >= STRENGTH_THRESHOLD,
    (a, b) => b - a,
  );
  const weaknesses = rank(
    signals,
    (s) => s <= WEAKNESS_THRESHOLD,
    (a, b) => a - b,
  );

  const strengthText = strengths.length ? joinPhrases(strengths, STRENGTH_PHRASE) : "";
  const weaknessText = weaknesses.length ? joinPhrases(weaknesses, WEAKNESS_PHRASE) : "";

  if (strengthText && weaknessText) {
    return `${base}: shows ${strengthText}, though held back by ${weaknessText}.`;
  }
  if (strengthText) {
    return `${base}: shows ${strengthText}.`;
  }
  if (weaknessText) {
    return `${base}: held back by ${weaknessText}.`;
  }
  return `${base}: a middling health profile without standout strengths or weaknesses.`;
}
