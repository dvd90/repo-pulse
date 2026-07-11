import { describe, it, expect } from "vitest";
import { parseRepo } from "../../src/lib/repo.js";
import { AppError } from "../../src/lib/errors.js";

describe("parseRepo", () => {
  it("accepts a valid owner/name", () => {
    expect(parseRepo("honojs/hono")).toEqual({
      owner: "honojs",
      name: "hono",
      full: "honojs/hono",
    });
  });

  it("accepts names with dots, dashes, underscores", () => {
    expect(parseRepo("a-b/c.d_e").full).toBe("a-b/c.d_e");
  });

  it("trims surrounding whitespace", () => {
    expect(parseRepo("  a/b  ").full).toBe("a/b");
  });

  it.each([
    undefined,
    "",
    "noslash",
    "a/b/c",
    "/b",
    "a/",
    "-bad/repo",
    "a/..",
    "a/.",
    "owner!/repo",
    "a b/c",
    "a/repo with space",
  ])("rejects %p", (input) => {
    expect(() => parseRepo(input as string)).toThrow(AppError);
  });

  it("rejects an owner longer than 39 chars", () => {
    expect(() => parseRepo(`${"a".repeat(40)}/repo`)).toThrow(AppError);
  });
});
