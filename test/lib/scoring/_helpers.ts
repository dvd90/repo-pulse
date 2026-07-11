import type { RepoSnapshot, SnapshotRepoMeta } from "../../../src/lib/scoring/snapshot.js";

/** A fixed reference "now" used by all unit tests. */
export const AS_OF = "2026-07-11T00:00:00.000Z";

/** ISO string for `days` before {@link AS_OF}. */
export function daysAgo(days: number): string {
  return new Date(Date.parse(AS_OF) - days * 86_400_000).toISOString();
}

/** ISO string for `hours` before {@link AS_OF}. */
export function hoursAgo(hours: number): string {
  return new Date(Date.parse(AS_OF) - hours * 3_600_000).toISOString();
}

/** Overrides accepted by {@link baseSnapshot}: like `RepoSnapshot`, but `meta`
 * may be a partial patch merged onto sensible defaults. */
type SnapshotOverrides = Partial<Omit<RepoSnapshot, "meta">> & {
  meta?: Partial<SnapshotRepoMeta>;
};

/**
 * Build a minimal, valid snapshot with empty collections; override any field to
 * isolate the signal under test. `meta` accepts a partial patch. Keeps unit
 * tests terse and focused.
 */
export function baseSnapshot(overrides: SnapshotOverrides = {}): RepoSnapshot {
  return {
    asOf: overrides.asOf ?? AS_OF,
    meta: {
      fullName: "acme/widget",
      archived: false,
      fork: false,
      disabled: false,
      description: "A widget.",
      license: "MIT",
      defaultBranch: "main",
      pushedAt: null,
      createdAt: "2020-01-01T00:00:00.000Z",
      stars: 10,
      openIssues: 0,
      ...(overrides.meta ?? {}),
    },
    commits: overrides.commits ?? [],
    releases: overrides.releases ?? [],
    issues: overrides.issues ?? [],
    pulls: overrides.pulls ?? [],
    contributors: overrides.contributors ?? [],
    tree: overrides.tree ?? [],
    dependencies: overrides.dependencies ?? null,
  };
}
