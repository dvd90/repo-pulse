# Registering x402 endpoints (the complete checklist)

Everything an x402 indexer — x402scan specifically, but the requirements
generalize — needs before it will register a paid endpoint. Distilled from
getting RepoPulse and Beef402 listed; each item below caused a real
rejection or warning at least once.

## The registration flow

1. Go to `x402scan.com` → **Add your API** → submit the base URL.
2. The scanner fetches `/openapi.json` first, then `/.well-known/x402`,
   builds the endpoint list, and probes every operation.
3. Endpoints that return a valid 402 challenge register; free endpoints
   marked `security: []` are skipped; everything else errors with a reason.
4. **Re-run Add after every deploy** — results reflect whatever was live at
   probe time, and some site metadata (title/description/favicon) is cached
   from earlier runs.

## 1. Discovery documents (both required)

- **`/.well-known/x402`** (same JSON at `/.well-known/x402.json`):

  ```json
  { "version": 1, "resources": ["https://<origin>/v1/health"] }
  ```

  Plain URL strings, origin-derived. Implementation: `src/routes/discovery.ts`.

- **`/openapi.json`** — OpenAPI 3.1. Per requirement:
  - `info.title`, `info.description` — become the listing title/blurb.
  - `info.contact.email` — ownership verification + contact button.
  - Paid operations: `x-payment-info` with `protocols: ["x402"]` and
    `price: { mode: "fixed", currency: "USD", amount: "0.01" }`, a declared
    `402` response, **and response schemas** (RepoPulse serves the full
    `HealthReport` JSON Schema) — missing output schemas registers with a
    warning and hurts agent compatibility.
  - Free operations: **`security: []`** — without it the scanner probes
    them for a 402 and reports errors.

## 2. The 402 challenge itself (what the probe validates)

- Non-empty `accepts` array; also encoded in the `PAYMENT-REQUIRED` header.
- `amount` in **token atomic units** (`$0.01` USDC → `"10000"`), not dollars.
- `asset` set to the USDC contract for the network.
- Bazaar agent-input metadata in the canonical `extensions.bazaar` shape —
  RepoPulse gets this from `declareDiscoveryExtension` + `@x402/hono`
  enrichment (`src/lib/x402/bazaar.ts`); never hand-roll the structure.

## 3. Probe behavior traps

- **Paywall before validation.** The probe sends bare requests (no params).
  RepoPulse originally validated `repo` before the payment gate → the probe
  got a 400 and registration failed. Now: an unpaid request always gets the
  402 challenge; the `repo` param is validated pre-settle only when a
  payment header is present, so payers can't be charged for a malformed
  request (`src/app.ts`).
- **GET-first probing.** The prober fetches resources GET-first;
  `/v1/health` is GET-native so no issue here. For POST-only paid
  resources, serve the challenge on GET too (see Beef402's
  `challengeOnly()` for the pattern) — Express-style routers return 404
  (not 405) for a wrong method, which the prober reads as a dead endpoint.
- **Mainnet only.** Indexed networks are `base` and `solana` — testnets are
  rejected (`No supported networks`). RepoPulse is on Base mainnet
  (`eip155:8453`) via the CDP facilitator.

## 4. Site polish (non-blocking but shown on the listing)

- **`/favicon.ico`** at the API root — embedded 16×16 ICO
  (`src/routes/discovery.ts`); shown next to the listing. The scanner
  caches this check; verify with `curl -sI <origin>/favicon.ico` (expect
  200 + `image/x-icon`) before assuming it's broken.
- Landing page `<title>` is used when no OpenAPI title fits.

## 5. Infrastructure gotchas (this deployment specifically)

- **x402 must be configured in prod**: `/v1/health` now exercises the
  payment middleware on every unpaid request — missing
  `WALLET_ADDRESS`/CDP secrets produce a 500, not a 402. Check `/readyz`.
- **Deploys are manual** (`npm run deploy`): a scan run before deploying
  probes the old version. Verify with curl before re-running Add.

## Verification block (run before every Add)

```bash
BASE=https://repo-pulse.dvd90.workers.dev
curl -s  $BASE/readyz                          # ready
curl -si "$BASE/v1/health" | head -3           # 402 + PAYMENT-REQUIRED (no repo param!)
curl -s  $BASE/.well-known/x402                # {version:1, resources:[...]}
curl -s  $BASE/openapi.json | grep -o 'dvdsellam@gmail.com'
curl -sI $BASE/favicon.ico | head -3           # 200, image/x-icon
```

## Related directories (same artifacts, no extra work)

The same discovery documents serve x402-list.com and other auto-indexers.
CDP Bazaar cataloging happens automatically after the first paid call
settles through the CDP facilitator — no registration step. Curated-list
PRs: `docs/awesome-x402-snippet.md`.
