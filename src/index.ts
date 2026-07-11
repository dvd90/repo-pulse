import { createApp } from "./app.js";
import type { Bindings } from "./env.js";

/**
 * Cloudflare Workers entrypoint. The app is built once per isolate (module
 * scope) and reused across requests.
 */
const app = createApp();

export default {
  fetch: app.fetch,
} satisfies ExportedHandler<Bindings>;
