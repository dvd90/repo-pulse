import type { RepoSnapshot } from "../snapshot.js";
import type { SignalResult } from "../types.js";
import { detectTests } from "./_detect.js";

/**
 * testPresence — does the repo ship a test suite?
 *
 * Rationale / curve:
 * Like CI, the presence of tests reads as binary from the tree. We score 100
 * when we find a conventional test directory (`test/`, `tests/`, `spec/`,
 * `__tests__/`) or test-named files (`*.test.*`, `*.spec.*`, `*_test.go`,
 * `test_*.py`, …) and 0 otherwise. The NO_TESTS flag mirrors the false case.
 */
export function testPresence(snapshot: RepoSnapshot): SignalResult {
  const hasTests = detectTests(snapshot.tree);
  return {
    score: hasTests ? 100 : 0,
    hasTests,
  };
}
