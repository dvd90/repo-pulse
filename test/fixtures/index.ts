import type { RepoSnapshot } from "../../src/lib/scoring/snapshot.js";
import { healthyRepo } from "./healthyRepo.js";
import { abandonedRepo } from "./abandonedRepo.js";
import { minimalRepo } from "./minimalRepo.js";

export { healthyRepo, abandonedRepo, minimalRepo };

/** All scoring fixtures keyed by name, for table-driven tests. */
export const FIXTURES: Record<string, RepoSnapshot> = {
  healthyRepo,
  abandonedRepo,
  minimalRepo,
};
