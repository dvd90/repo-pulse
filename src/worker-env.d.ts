/// <reference types="@cloudflare/vitest-pool-workers/types" />

import type { Bindings } from "./env.js";

// The `cloudflare:test` module types `env` as `Cloudflare.Env`. We map that to
// our own `Bindings` so tests get fully-typed access to the Worker's bindings
// without depending on the git-ignored generated `worker-configuration.d.ts`.
declare global {
  namespace Cloudflare {
    type Env = Bindings;
  }
}

export {};
