import { describe, it, expect } from "vitest";
import { ciPresence } from "../../../src/lib/scoring/signals/ciPresence.js";
import { testPresence } from "../../../src/lib/scoring/signals/testPresence.js";
import { docs } from "../../../src/lib/scoring/signals/docs.js";
import { baseSnapshot } from "./_helpers.js";
import type { SnapshotTreeEntry } from "../../../src/lib/scoring/snapshot.js";

const blob = (path: string): SnapshotTreeEntry => ({ path, type: "blob" });
const tree = (path: string): SnapshotTreeEntry => ({ path, type: "tree" });

describe("ciPresence", () => {
  it.each([
    [".github/workflows/ci.yml"],
    [".github/workflows/deploy.yaml"],
    [".gitlab-ci.yml"],
    ["azure-pipelines.yml"],
    [".travis.yml"],
    ["Jenkinsfile"],
    [".drone.yml"],
    ["bitbucket-pipelines.yml"],
  ])("detects CI from %s", (path) => {
    expect(ciPresence(baseSnapshot({ tree: [blob(path)] })).score).toBe(100);
  });

  it("detects CircleCI from a .circleci/ directory", () => {
    expect(
      ciPresence(baseSnapshot({ tree: [tree(".circleci"), blob(".circleci/config.yml")] })).hasCI,
    ).toBe(true);
  });

  it("scores 0 and flags no CI when absent", () => {
    const r = ciPresence(baseSnapshot({ tree: [blob("README.md"), blob("src/index.ts")] }));
    expect(r.score).toBe(0);
    expect(r.hasCI).toBe(false);
  });

  it("ignores non-workflow files under .github", () => {
    expect(ciPresence(baseSnapshot({ tree: [blob(".github/FUNDING.yml")] })).hasCI).toBe(false);
  });
});

describe("testPresence", () => {
  it.each([["test"], ["tests"], ["spec"], ["__tests__"]])("detects a %s/ directory", (dir) => {
    expect(testPresence(baseSnapshot({ tree: [tree(dir)] })).score).toBe(100);
  });

  it.each([
    ["src/foo.test.ts"],
    ["src/foo.spec.js"],
    ["pkg/handler_test.go"],
    ["test_main.py"],
    ["lib/thing_test.py"],
  ])("detects test-named file %s", (path) => {
    expect(testPresence(baseSnapshot({ tree: [blob(path)] })).hasTests).toBe(true);
  });

  it("scores 0 when no tests are present", () => {
    const r = testPresence(baseSnapshot({ tree: [blob("src/index.ts"), blob("README.md")] }));
    expect(r.score).toBe(0);
    expect(r.hasTests).toBe(false);
  });
});

describe("docs", () => {
  it("awards full marks for readme + docs dir + license + description", () => {
    const r = docs(
      baseSnapshot({
        tree: [blob("README.md"), tree("docs"), blob("LICENSE")],
        meta: { description: "A thing.", license: "MIT" },
      }),
    );
    expect(r.score).toBe(100);
    expect(r).toMatchObject({
      hasReadme: true,
      hasDocsDir: true,
      hasLicense: true,
      hasDescription: true,
    });
  });

  it("recognizes a license from metadata even without a LICENSE file", () => {
    const r = docs(baseSnapshot({ tree: [blob("README.md")], meta: { license: "Apache-2.0" } }));
    expect(r.hasLicense).toBe(true);
  });

  it("treats an empty/whitespace description as missing", () => {
    const r = docs(
      baseSnapshot({ tree: [blob("README.md")], meta: { description: "   ", license: null } }),
    );
    expect(r.hasDescription).toBe(false);
  });

  it("scores 0 for a bare repo with nothing", () => {
    const r = docs(
      baseSnapshot({ tree: [blob("index.js")], meta: { description: null, license: null } }),
    );
    expect(r.score).toBe(0);
  });
});
