import type { Bindings } from "./env.js";
import type { Logger } from "./lib/log.js";

/** Hono generics shared across the app: bindings + per-request context vars. */
export interface AppEnv {
  Bindings: Bindings;
  Variables: {
    callId: string;
    log: Logger;
  };
}
