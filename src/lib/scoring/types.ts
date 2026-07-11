/**
 * RepoPulse response domain types. Versioned `repopulse.v1`. The scoring output
 * is deterministic: identical repo state always yields an identical score.
 */

export const SCHEMA_VERSION = "repopulse.v1" as const;

/** The nine health signals, in canonical order. */
export const SIGNAL_KEYS = [
  "commitRecency",
  "releaseCadence",
  "issueHygiene",
  "prFlow",
  "busFactor",
  "ciPresence",
  "testPresence",
  "docs",
  "depFreshness",
] as const;

export type SignalKey = (typeof SIGNAL_KEYS)[number];

/** Flags describing notable repo conditions surfaced to consumers. */
export type HealthFlag =
  | "ARCHIVED"
  | "NO_LICENSE"
  | "SINGLE_MAINTAINER"
  | "NO_CI"
  | "NO_TESTS"
  | "NO_DESCRIPTION"
  | "STALE"
  | "NO_RELEASES"
  | "FORK";

export type Grade = "A" | "B" | "C" | "D" | "F";

/**
 * A single signal result: a 0–100 sub-score plus the raw metrics that produced
 * it (so consumers can see *why*). `metrics` shape varies per signal.
 */
export interface SignalResult {
  score: number;
  [metric: string]: number | string | boolean | null;
}

export type SignalBreakdown = Record<SignalKey, SignalResult>;

/** The full, deterministic health report. */
export interface HealthReport {
  schemaVersion: typeof SCHEMA_VERSION;
  repo: string;
  score: number;
  grade: Grade;
  signals: SignalBreakdown;
  weights: Record<SignalKey, number>;
  flags: HealthFlag[];
  summary: string;
  /** ISO timestamp the score was computed. */
  generatedAt: string;
  /** True when served from a stale cache because GitHub was slow/unavailable. */
  stale?: boolean;
}
