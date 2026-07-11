import type { SnapshotDependencies, SnapshotTreeEntry } from "../scoring/snapshot.js";

/**
 * Best-effort dependency manifest detection and pinned-ratio extraction. We
 * don't resolve the registry (no network per-dependency); "pinned" is a proxy
 * for freshness: a dependency with an exact/committed version is treated as
 * intentionally managed, a wildcard/range as looser. This is documented as a
 * heuristic, not a definitive freshness measure.
 */

/** Ordered manifest preference — first match at repo root wins. */
const MANIFESTS = [
  "package.json",
  "requirements.txt",
  "go.mod",
  "Cargo.toml",
  "Gemfile",
  "pyproject.toml",
  "pom.xml",
] as const;

export type ManifestName = (typeof MANIFESTS)[number];

/** Find the first known dependency manifest at the repo root. */
export function detectManifest(tree: SnapshotTreeEntry[]): ManifestName | null {
  const rootFiles = new Set(
    tree.filter((e) => e.type === "blob" && !e.path.includes("/")).map((e) => e.path),
  );
  for (const m of MANIFESTS) {
    if (rootFiles.has(m)) return m;
  }
  return null;
}

/**
 * Parse a manifest's raw text into a `SnapshotDependencies` summary. Returns
 * null when nothing parseable is found. Parsing is intentionally forgiving.
 */
export function parseManifest(manifest: ManifestName, raw: string): SnapshotDependencies | null {
  switch (manifest) {
    case "package.json":
      return parsePackageJson(raw);
    case "requirements.txt":
      return parseRequirementsTxt(raw);
    case "go.mod":
      return parseGoMod(raw);
    case "Cargo.toml":
      return parseCargoToml(raw);
    case "Gemfile":
      return parseGemfile(raw);
    case "pyproject.toml":
      return parsePyproject(raw);
    case "pom.xml":
      return parsePomXml(raw);
    default:
      return null;
  }
}

function summarize(manifest: ManifestName, specs: string[]): SnapshotDependencies {
  const total = specs.length;
  const pinned = specs.filter(isPinnedSpec).length;
  return { manifest, total, pinned };
}

/**
 * A spec counts as "pinned" when it lacks range operators (`^ ~ >= <= > < *`,
 * "x" wildcards, or "latest"). Exact versions and git/commit refs count as
 * pinned.
 */
function isPinnedSpec(spec: string): boolean {
  const s = spec.trim().toLowerCase();
  if (s.length === 0) return false;
  if (s === "*" || s === "latest" || s.includes("x")) return false;
  return !/[\^~><]|\|\||\s-\s/.test(s);
}

function parsePackageJson(raw: string): SnapshotDependencies | null {
  try {
    const json = JSON.parse(raw) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const specs = [
      ...Object.values(json.dependencies ?? {}),
      ...Object.values(json.devDependencies ?? {}),
    ];
    if (specs.length === 0) return { manifest: "package.json", total: 0, pinned: 0 };
    return summarize("package.json", specs);
  } catch {
    return null;
  }
}

function parseRequirementsTxt(raw: string): SnapshotDependencies {
  const specs = raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#") && !l.startsWith("-"))
    .map((l) => {
      const m = /^[A-Za-z0-9._-]+\s*(.*)$/.exec(l);
      return m ? (m[1] ?? "") : "";
    });
  return summarize("requirements.txt", specs);
}

function parseGoMod(raw: string): SnapshotDependencies {
  // Every `require` line has a pinned semver (Go modules are always pinned), so
  // each match contributes a pinned spec.
  const matches = raw.match(/^\s*(?:require\s+)?[\w./-]+\s+v[\w.+-]+/gm) ?? [];
  const specs = matches.map(() => "1.0.0");
  return summarize("go.mod", specs);
}

function parseCargoToml(raw: string): SnapshotDependencies {
  return summarizeTomlDeps("Cargo.toml", raw);
}

function parsePyproject(raw: string): SnapshotDependencies {
  return summarizeTomlDeps("pyproject.toml", raw);
}

function summarizeTomlDeps(manifest: ManifestName, raw: string): SnapshotDependencies {
  const specs: string[] = [];
  let inDeps = false;
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("[")) {
      inDeps = /dependencies\]?$/.test(trimmed) || trimmed.includes("dependencies");
      continue;
    }
    if (!inDeps || trimmed.length === 0 || trimmed.startsWith("#")) continue;
    const m = /=\s*"([^"]+)"/.exec(trimmed);
    if (m && m[1] !== undefined) specs.push(m[1]);
  }
  return summarize(manifest, specs);
}

function parseGemfile(raw: string): SnapshotDependencies {
  const specs: string[] = [];
  const gemRe = /gem\s+['"][^'"]+['"]\s*,\s*['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = gemRe.exec(raw)) !== null) specs.push(match[1] ?? "");
  // gems without a version constraint are unpinned floats
  const bare = (raw.match(/^\s*gem\s+['"][^'"]+['"]\s*$/gm) ?? []).length;
  for (let i = 0; i < bare; i++) specs.push("*");
  return summarize("Gemfile", specs);
}

function parsePomXml(raw: string): SnapshotDependencies {
  const versions = [...raw.matchAll(/<version>([^<]+)<\/version>/g)].map((m) => m[1] ?? "");
  // Drop the project's own version (first) heuristically if there are many.
  return summarize("pom.xml", versions);
}
