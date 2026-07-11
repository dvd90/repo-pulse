/**
 * Structural detection over the repo tree. These are pure predicates on the
 * snapshot's `tree` (path + type) plus `meta`, shared by the ciPresence,
 * testPresence and docs signals. Matching is case-insensitive and works on
 * both the full path and its individual segments so nested layouts are caught.
 */
import type { SnapshotTreeEntry } from "../snapshot.js";

function segments(path: string): string[] {
  return path.split("/").filter((s) => s.length > 0);
}

function basename(path: string): string {
  const segs = segments(path);
  return segs.length === 0 ? "" : (segs[segs.length - 1] as string);
}

/** Continuous-integration configuration present anywhere in the tree. */
export function detectCI(tree: SnapshotTreeEntry[]): boolean {
  return tree.some((e) => {
    const path = e.path.toLowerCase();
    const base = basename(path);
    if (e.type === "blob" && path.startsWith(".github/workflows/")) {
      return path.endsWith(".yml") || path.endsWith(".yaml");
    }
    if (path.startsWith(".circleci/")) return true;
    return (
      base === ".gitlab-ci.yml" ||
      base === "azure-pipelines.yml" ||
      base === ".travis.yml" ||
      base === "jenkinsfile" ||
      base === "bitbucket-pipelines.yml" ||
      base === ".drone.yml" ||
      base === "appveyor.yml" ||
      base === ".appveyor.yml"
    );
  });
}

const TEST_DIR_NAMES = new Set(["test", "tests", "spec", "specs", "__tests__"]);

/** A test suite / test directories or test-named files present. */
export function detectTests(tree: SnapshotTreeEntry[]): boolean {
  return tree.some((e) => {
    const path = e.path.toLowerCase();
    const segs = segments(path);
    if (e.type === "tree") {
      return segs.some((s) => TEST_DIR_NAMES.has(s));
    }
    // Any test directory in the file's path also counts.
    if (segs.slice(0, -1).some((s) => TEST_DIR_NAMES.has(s))) return true;
    const base = basename(path);
    return (
      /\.(test|spec)\.[a-z0-9]+$/.test(base) ||
      /_test\.go$/.test(base) ||
      /_test\.py$/.test(base) ||
      /^test_.+\.py$/.test(base) ||
      /_test\.rb$/.test(base) ||
      /test.+\.java$/.test(base) ||
      /.+test\.java$/.test(base)
    );
  });
}

/** A README file present at any level. */
export function detectReadme(tree: SnapshotTreeEntry[]): boolean {
  return tree.some((e) => e.type === "blob" && basename(e.path.toLowerCase()).startsWith("readme"));
}

/** A dedicated documentation directory (`docs/` or `doc/`). */
export function detectDocsDir(tree: SnapshotTreeEntry[]): boolean {
  return tree.some((e) => {
    const segs = segments(e.path.toLowerCase());
    return e.type === "tree" && segs.some((s) => s === "docs" || s === "doc");
  });
}

/** A LICENSE file present in the tree (independent of `meta.license`). */
export function detectLicenseFile(tree: SnapshotTreeEntry[]): boolean {
  return tree.some((e) => {
    const base = basename(e.path.toLowerCase());
    return e.type === "blob" && (base.startsWith("license") || base.startsWith("copying"));
  });
}
