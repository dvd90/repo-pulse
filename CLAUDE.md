# RepoPulse — engineering guide (CLAUDE.md)

Pay-per-call **Repo Health Score API**. Give it a public GitHub repo, get back a
deterministic 0–100 health score with a per-signal breakdown. Deployed on
**Cloudflare Workers**, monetized with the **x402** protocol (HTTP 402 + USDC
micropayments on Base), discoverable via the **x402 Bazaar**.

## Stack

- **Cloudflare Workers** + **Hono** + TypeScript (strict).
- **x402 v2 SDK**: `@x402/core`, `@x402/evm`, `@x402/hono`, `@x402/extensions`
  (Bazaar). Network `eip155:8453` (Base mainnet). Header `PAYMENT-SIGNATURE`
  (v1 `X-PAYMENT` also accepted by the SDK).
- Facilitator: **Coinbase CDP** (`https://api.cdp.coinbase.com/platform/v2/x402`).
- **Workers KV** for response caching (15-min TTL). No DB, no in-memory cache
  (isolates don't persist).
- Tests: **vitest** with **@cloudflare/vitest-pool-workers** (runs in workerd).

## Commands

| Command | What |
| --- | --- |
| `npm run dev` | Local dev server via wrangler |
| `npm run verify` | **Gate for every milestone**: typecheck + lint + tests |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` / `lint:fix` | ESLint |
| `npm run test` / `test:watch` | Vitest (workerd pool) |
| `npm run deploy` | `wrangler deploy` to production |
| `npm run cf-typegen` | Regenerate Worker types (git-ignored) |

## Conventions (ported from the Chassis boilerplate — keep this discipline)

- **Thin handlers.** All logic lives in `src/lib/` services; routes just parse,
  call a service, and shape a response.
- **One response helper.** `src/lib/response.ts` — `ok` / `created` / `error`
  envelopes. Every JSON response shares a shape: `{ ok, data|error, callId }`.
- **Single error type.** Throw `AppError(code, message, status?, details?)`
  (`src/lib/errors.ts`). The central Hono `onError` handler
  (`src/lib/errorHandler.ts`) maps it — handlers never juggle status codes.
- **callId correlation.** `src/middleware/callId.ts` honors an incoming
  `x-call-id` or mints one; echoed in the response header and every log line
  and response envelope.
- **Zod validation.** Query/params validated with structured 400s; env is
  Zod-validated at request time (`src/env.ts`) and fails loudly on bad config.
- **Determinism.** Same repo state ⇒ same score. No `Date.now()` inside the
  scorers — the reference "now" is carried on the snapshot (`asOf`). No LLM in
  the serving path.

## Layout

```
src/
  index.ts              Worker entrypoint (fetch)
  app.ts                Hono app assembly (middleware + routes)
  env.ts                Bindings type + Zod env validation -> Config
  types.ts              Hono AppEnv generics (Bindings + Variables)
  worker-env.d.ts       Maps cloudflare:test env to our Bindings
  middleware/
    callId.ts           x-call-id correlation
    logger.ts           structured request logger
  lib/
    errors.ts           AppError + codes
    errorHandler.ts     central onError / onNotFound
    response.ts         ok/created/error envelopes
    log.ts              JSON structured logger
    repo.ts             strict owner/name parsing
    scoring/
      types.ts          HealthReport domain types + SIGNAL_KEYS
      snapshot.ts       RepoSnapshot (normalized GitHub input to scoring)
      weights.ts        signal weights (single source of truth)
      grade.ts          score -> A–F
      schema.ts         JSON Schema for the response (served at /v1/schema)
  routes/
    system.ts           /healthz, /readyz
    schema.ts           /v1/schema
```

## Endpoints

- `GET /v1/health?repo={owner}/{name}` — **paid, $0.01 USDC** (x402). *(M2)*
- `GET /v1/schema` — free; response JSON Schema + active weights.
- `GET /healthz` — free liveness.
- `GET /readyz` — free readiness (config + KV + facilitator reachability).
- `GET /.well-known/x402` (+ `.json` alias) — free; x402 discovery document
  listing paid resources (consumed by x402scan and other indexers).
- `GET /openapi.json` — free; OpenAPI 3.1 with `x-payment-info` on `/v1/health`.
  Both discovery routes return raw spec JSON, not the app envelope.

## Configuration & secrets

Non-secret config is in `wrangler.toml` `[vars]`. Secrets via
`wrangler secret put`:

- `WALLET_ADDRESS` — payTo address for x402 settlement (required).
- `GITHUB_TOKEN` — optional, raises GitHub REST rate limits.
- `CDP_API_KEY_ID`, `CDP_API_KEY_SECRET` — CDP facilitator auth (M2).

For local dev, put these in `.dev.vars` (git-ignored).

## Milestone status

- [x] **M0 — Scaffold**: wrangler project, Hono app, `/healthz`, `/readyz`,
      `/v1/schema`, callId middleware, error handler, structured logging, CI
      (`.github/workflows/verify.yml`), CLAUDE.md. `npm run verify` green.
- [x] **M1 — Scoring core**: GitHub fetcher (`src/lib/github/`, fully mocked in
      tests) + nine signal calculators + composite scorer (`src/lib/scoring/`).
      Golden-file tests over three fixtures (healthy A/92, abandoned F/12,
      minimal D/50). `HealthCache` (KV) and `getHealthReport` service wired.
- [x] **M2 — x402**: payment middleware on `/v1/health` (`src/lib/x402/`), CDP
      facilitator client (JWT auth), Bazaar discovery extension with full
      input/output schemas. Integration test simulates 402 → pay → retry against
      a fake facilitator in workerd (verify + settle consulted). 110 tests green.
- [ ] **M3 — Hardening + deploy**: KV cache (done), rate-limit handling (done),
      5s budget with `stale` flag (done) — remaining: README, one real Base
      mainnet settlement, `wrangler deploy`, Bazaar indexing, awesome-x402 PR.

## Notes for future edits

- Real infra already provisioned in this Cloudflare account: KV namespace
  `repo-pulse-health-cache` (id `3c5ebed75e404b10bb826ccfa97ad5d8`), wired as
  the `HEALTH_CACHE` binding in `wrangler.toml`.
- vitest-pool-workers **v4** API: the Workers integration is the `cloudflareTest`
  Vite plugin (`vitest.config.ts`), not the legacy `test.poolOptions.workers`.
