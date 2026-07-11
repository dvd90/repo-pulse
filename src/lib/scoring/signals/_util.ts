/**
 * Small deterministic helpers shared by the signal calculators. Kept separate so
 * every signal uses the same clamping/rounding/time math and no scorer ever
 * reaches for `Date.now()` — all recency is measured against the snapshot's
 * `asOf` reference time.
 */

/** Milliseconds in a day. */
const MS_PER_DAY = 86_400_000;
/** Milliseconds in an hour. */
const MS_PER_HOUR = 3_600_000;

/**
 * Coerce a raw numeric sub-score into a valid, integer [0,100] score. Guards
 * against NaN/Infinity/negatives/overflow so a signal can never emit an invalid
 * value into the report.
 */
export function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0;
  const r = Math.round(n);
  if (r < 0) return 0;
  if (r > 100) return 100;
  return r;
}

/** Clamp an arbitrary number into [lo, hi] (no rounding). */
export function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Whole/fractional days from `fromISO` to `toISO` (positive when `toISO` is
 * later). Returns `null` if either timestamp is missing or unparseable, so
 * callers make an explicit decision about missing data rather than silently
 * scoring NaN.
 */
export function daysBetween(fromISO: string | null, toISO: string | null): number | null {
  if (!fromISO || !toISO) return null;
  const from = Date.parse(fromISO);
  const to = Date.parse(toISO);
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  return (to - from) / MS_PER_DAY;
}

/** Fractional hours from `fromISO` to `toISO`, or `null` if unparseable. */
export function hoursBetween(fromISO: string | null, toISO: string | null): number | null {
  if (!fromISO || !toISO) return null;
  const from = Date.parse(fromISO);
  const to = Date.parse(toISO);
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  return (to - from) / MS_PER_HOUR;
}

/**
 * Exponential decay to a 0–100 score: full marks up to `gentle` units of age,
 * then a half-life decay. At `age == gentle + halfLife` the score is 50.
 * Deterministic and monotonically non-increasing in `age`.
 */
export function decayScore(age: number, gentle: number, halfLife: number): number {
  if (!Number.isFinite(age)) return 0;
  if (age <= gentle) return 100;
  if (halfLife <= 0) return 0;
  const decayed = 100 * Math.pow(0.5, (age - gentle) / halfLife);
  return clamp(decayed, 0, 100);
}

/**
 * Median of a numeric list using an explicit numeric sort (never the default
 * lexicographic `Array.sort`). Returns `null` for an empty list.
 */
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid] as number;
  }
  return ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}
