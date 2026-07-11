import { SCHEMA_VERSION, SIGNAL_KEYS } from "./types.js";
import { WEIGHTS } from "./weights.js";

/**
 * JSON Schema (draft 2020-12) describing the RepoPulse health response. Served
 * verbatim at `GET /v1/schema` and reused as the Bazaar output schema so paying
 * agents know exactly what they receive. Kept hand-written (not generated) so
 * the per-field descriptions stay agent-facing and precise.
 */

const signalDescriptions: Record<(typeof SIGNAL_KEYS)[number], string> = {
  commitRecency: "How recently the default branch was updated; decays as the last commit ages.",
  releaseCadence: "Regularity and recency of published releases/tags.",
  issueHygiene: "Issue close rate and responsiveness (open/closed ratio, age of open issues).",
  prFlow: "Pull-request throughput: merge rate and how quickly PRs are resolved.",
  busFactor: "Concentration of contributions; low when a single author dominates.",
  ciPresence: "Whether continuous-integration configuration is present.",
  testPresence: "Whether a test suite / test directories are present.",
  docs: "Presence and depth of documentation (README, docs/, license, description).",
  depFreshness: "Best-effort freshness of declared dependencies from the manifest.",
};

const signalProperties = Object.fromEntries(
  SIGNAL_KEYS.map((k) => [
    k,
    {
      type: "object",
      description: signalDescriptions[k],
      properties: {
        score: { type: "number", minimum: 0, maximum: 100, description: "0–100 sub-score." },
      },
      required: ["score"],
      additionalProperties: true,
    },
  ]),
);

export const HEALTH_RESPONSE_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://repo-pulse/schema/repopulse.v1.json",
  title: "RepoPulse Health Report",
  description:
    "Deterministic health assessment of a public GitHub repository. The same repository state always yields the same score.",
  type: "object",
  properties: {
    schemaVersion: {
      type: "string",
      const: SCHEMA_VERSION,
      description: "Response schema version.",
    },
    repo: {
      type: "string",
      description: "Canonical owner/name identifier of the scored repository.",
    },
    score: {
      type: "integer",
      minimum: 0,
      maximum: 100,
      description: "Composite health score, 0 (worst) to 100 (best).",
    },
    grade: {
      type: "string",
      enum: ["A", "B", "C", "D", "F"],
      description: "Letter grade derived from the score.",
    },
    signals: {
      type: "object",
      description:
        "Per-signal breakdown; each entry has a 0–100 score plus signal-specific metrics.",
      properties: signalProperties,
      required: [...SIGNAL_KEYS],
      additionalProperties: false,
    },
    weights: {
      type: "object",
      description: "Relative weight applied to each signal when computing the composite score.",
      properties: Object.fromEntries(SIGNAL_KEYS.map((k) => [k, { type: "number" }])),
      required: [...SIGNAL_KEYS],
      additionalProperties: false,
    },
    flags: {
      type: "array",
      description: "Notable conditions, e.g. ARCHIVED, NO_LICENSE, SINGLE_MAINTAINER, STALE.",
      items: {
        type: "string",
        enum: [
          "ARCHIVED",
          "NO_LICENSE",
          "SINGLE_MAINTAINER",
          "NO_CI",
          "NO_TESTS",
          "NO_DESCRIPTION",
          "STALE",
          "NO_RELEASES",
          "FORK",
        ],
      },
    },
    summary: {
      type: "string",
      description: "One-sentence, human-readable summary of the repository's health.",
    },
    generatedAt: {
      type: "string",
      format: "date-time",
      description: "When the score was computed (ISO-8601).",
    },
    stale: {
      type: "boolean",
      description:
        "Present and true when served from cache because GitHub was slow or unavailable.",
    },
  },
  required: [
    "schemaVersion",
    "repo",
    "score",
    "grade",
    "signals",
    "weights",
    "flags",
    "summary",
    "generatedAt",
  ],
  additionalProperties: false,
  examples: [
    {
      schemaVersion: SCHEMA_VERSION,
      repo: "honojs/hono",
      score: 91,
      grade: "A",
      signals: {
        commitRecency: { score: 100, daysSinceLastCommit: 0 },
        releaseCadence: { score: 88, releasesLast90Days: 3, daysSinceLastRelease: 12 },
        issueHygiene: { score: 82, openIssues: 40, closeRatio: 0.86 },
        prFlow: { score: 90, mergeRatio: 0.78, medianMergeHours: 20 },
        busFactor: { score: 74, topAuthorShare: 0.41, effectiveContributors: 6 },
        ciPresence: { score: 100, hasCI: true },
        testPresence: { score: 100, hasTests: true },
        docs: { score: 92, hasReadme: true, hasDocsDir: true, hasLicense: true },
        depFreshness: { score: 80, manifest: "package.json", pinnedRatio: 0.8 },
      },
      weights: WEIGHTS,
      flags: [],
      summary: "Actively maintained with strong CI, tests, and a healthy contributor base.",
      generatedAt: "2026-07-11T00:00:00.000Z",
    },
  ],
} as const;
