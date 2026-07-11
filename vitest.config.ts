import { defineConfig } from "vitest/config";
import { cloudflareTest } from "@cloudflare/vitest-pool-workers";

// vitest-pool-workers v4 API: the Workers integration is a Vite plugin
// (`cloudflareTest`) that receives the pool options directly, instead of the
// legacy `test.poolOptions.workers` config.
export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.toml" },
      miniflare: {
        // Test-time bindings. Real secrets are never needed in tests; the
        // GitHub fetcher and facilitator are mocked at the fetch boundary.
        bindings: {
          WALLET_ADDRESS: "0x000000000000000000000000000000000000dEaD",
          GITHUB_TOKEN: "",
          CDP_API_KEY_ID: "test-key-id",
          CDP_API_KEY_SECRET: "test-key-secret",
        },
      },
    }),
  ],
});
