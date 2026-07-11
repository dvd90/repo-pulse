import type { Bindings } from "./env.js";
import type { Logger } from "./lib/log.js";

/** Hono generics shared across the app: bindings + per-request context vars. */
export interface AppEnv {
  Bindings: Bindings;
  Variables: {
    callId: string;
    log: Logger;
    /**
     * Optional injected fetch used by the GitHub fetcher. Undefined in
     * production (global fetch is used); tests set it to mock the GitHub API.
     */
    githubFetch?: typeof fetch;
  };
}
