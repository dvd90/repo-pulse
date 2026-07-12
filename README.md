# RepoPulse — Repo Health Score API (x402 pay-per-call)

RepoPulse returns a **deterministic 0–100 health score** for any public GitHub
repository, with a full per-signal breakdown. It runs on **Cloudflare Workers**
and is monetized with the **[x402](https://x402.org) protocol** — HTTP 402 +
USDC micropayments on **Base** — so autonomous agents can pay $0.01 per call with
no account, API key, or subscription.

- **Paid:** `GET /v1/health?repo={owner}/{name}` — **$0.01 USDC** via x402
- **Free:** `GET /v1/schema`, `GET /healthz`, `GET /readyz`
- Deterministic: identical repo state ⇒ identical score. **No LLM in the serving path.**
- Discoverable in the **x402 Bazaar** with full input/output schemas.

---

## What you get

The score is a weighted average of nine signals, each scored 0–100 with the raw
metrics that produced it:

| Signal | What it measures |
| --- | --- |
| `commitRecency` | How recently the default branch was updated |
| `releaseCadence` | Regularity/recency of published releases |
| `issueHygiene` | Issue close rate and responsiveness |
| `prFlow` | PR merge rate and time-to-resolution |
| `busFactor` | Contribution concentration (single-maintainer risk) |
| `ciPresence` | CI configuration present |
| `testPresence` | Test suite present |
| `docs` | README, docs/, license, description |
| `depFreshness` | Best-effort dependency manifest freshness |

Plus a letter `grade` (A–F), `flags` (e.g. `ARCHIVED`, `NO_LICENSE`,
`SINGLE_MAINTAINER`, `STALE`), and a one-sentence `summary`. Weights live in one
documented place: [`src/lib/scoring/weights.ts`](src/lib/scoring/weights.ts). The
full response JSON Schema is served live at `GET /v1/schema`.

### Example response (abridged)

```json
{
  "ok": true,
  "data": {
    "schemaVersion": "repopulse.v1",
    "repo": "honojs/hono",
    "score": 91,
    "grade": "A",
    "signals": {
      "commitRecency": { "score": 100, "daysSinceLastCommit": 0 },
      "busFactor": { "score": 74, "topAuthorShare": 0.41, "effectiveContributors": 6 },
      "ciPresence": { "score": 100, "hasCI": true }
    },
    "flags": [],
    "summary": "Actively maintained with strong CI, tests, and a healthy contributor base.",
    "generatedAt": "2026-07-11T00:00:00.000Z"
  },
  "callId": "…"
}
```

---

## Quick start (curl)

Free endpoints work with plain curl:

```bash
BASE=https://repo-pulse.<your-subdomain>.workers.dev

# Liveness / readiness
curl "$BASE/healthz"
curl "$BASE/readyz"

# Response schema + active weights (free)
curl "$BASE/v1/schema"
```

Hitting the paid endpoint without payment returns a spec-correct **402** with
the payment requirements in the `PAYMENT-REQUIRED` header:

```bash
curl -i "$BASE/v1/health?repo=honojs/hono"
# HTTP/1.1 402 Payment Required
# payment-required: <base64 PaymentRequired: accepts[], Bazaar discovery extension>
```

An obviously-malformed `repo` is rejected with **400 before** any charge:

```bash
curl -i "$BASE/v1/health?repo=not-a-repo"   # 400 invalid_repo
```

---

## How agents pay

Agents don't need an account — they pay per call over HTTP using an x402 client.
The flow:

1. **Request** `GET /v1/health?repo=owner/name`.
2. Server replies **402** with a `PAYMENT-REQUIRED` header describing the
   `exact` scheme, network `eip155:8453` (Base mainnet), amount `10000`
   (= $0.01 USDC, 6 decimals), and the `payTo` address.
3. The client signs a USDC `TransferWithAuthorization` (EIP-3009) and **retries**
   with a `PAYMENT-SIGNATURE` header.
4. The server verifies + settles via the **Coinbase CDP facilitator**, runs the
   scoring, and returns **200** with the report and a `PAYMENT-RESPONSE` header
   (settlement tx).

With the official `@x402/fetch` wrapper this is transparent:

```ts
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount(process.env.EVM_PRIVATE_KEY as `0x${string}`);

const fetchWithPay = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [{ network: "eip155:8453", client: new ExactEvmScheme(account) }],
});

const res = await fetchWithPay(
  "https://repo-pulse.<subdomain>.workers.dev/v1/health?repo=honojs/hono",
);
const { data } = await res.json();
console.log(data.score, data.grade); // e.g. 91 A
```

The endpoint is also published in the **x402 Bazaar** discovery index, so agents
can find it (and its exact input/output schema) programmatically.

### Use it as an MCP tool

An MCP bridge server ([`mcp/`](mcp/README.md)) exposes RepoPulse as tools for any
MCP host (Claude Desktop, Cursor, …): `get_repo_health` (paid, auto-settles via
x402) and `get_repo_pulse_schema` (free). Point your host at
`mcp/repo-pulse-mcp.ts` with a funded Base wallet key and ask, e.g., *"score
honojs/hono"* — the payment happens under the hood. See
[`mcp/README.md`](mcp/README.md) for the config snippet.

---

## Architecture

Cloudflare Worker + [Hono](https://hono.dev) (TypeScript, strict). See
[`CLAUDE.md`](CLAUDE.md) for conventions and layout. Highlights:

- **Deterministic scoring** in `src/lib/scoring/` — pure functions of a
  normalized `RepoSnapshot`; the reference "now" is carried on the snapshot so
  there's no hidden clock. Signal weights are centralized and documented.
- **GitHub fetcher** in `src/lib/github/` — GitHub REST v3 via `fetch`, optional
  `GITHUB_TOKEN`, with a per-call timeout budget and typed error classification
  (404 → `repo_not_found`, 403/429 → `upstream_rate_limited` with `Retry-After`,
  aborts → `upstream_timeout`).
- **Response cache** in Workers KV (`src/lib/cache/`) — key `health:{owner}/{name}`,
  15-min TTL. If GitHub is slow, rate-limited, or erroring and a cached report
  exists, RepoPulse serves it with `"stale": true` instead of failing.
- **x402 payment gate** in `src/lib/x402/` — middleware on `/v1/health` only,
  wired to the CDP facilitator, with the Bazaar discovery extension attached.

## Development

```bash
npm install
npm run dev            # local worker at http://localhost:8787
npm run verify         # typecheck + lint + tests (the milestone gate)
```

Tests run **inside workerd** via `@cloudflare/vitest-pool-workers`. The GitHub
API and the x402 facilitator are mocked at their boundaries, so the full
suite — including the 402 → pay → retry flow — runs offline and deterministically.

## Deploy

```bash
# One-time: set secrets (KV namespace is already bound in wrangler.toml)
wrangler secret put WALLET_ADDRESS
wrangler secret put GITHUB_TOKEN         # optional
wrangler secret put CDP_API_KEY_ID
wrangler secret put CDP_API_KEY_SECRET

# Production (Base mainnet, CDP facilitator)
npm run deploy

# Staging (Base Sepolia testnet, public facilitator)
wrangler deploy --env staging
```

Config split: non-secret vars in [`wrangler.toml`](wrangler.toml); secrets via
`wrangler secret put`. Env is Zod-validated at request time and fails loudly on
misconfiguration.

## Verifying a real payment on Base mainnet

The automated suite proves the protocol flow against a mocked facilitator. To
prove a real settlement end-to-end you need a funded Base wallet (a little USDC +
gas) and the deployed URL:

```bash
# scripts/real-payment.ts (see repo) — uses @x402/fetch + a real key
EVM_PRIVATE_KEY=0x… \
API_URL="https://repo-pulse.<subdomain>.workers.dev/v1/health?repo=honojs/hono" \
  npx tsx scripts/real-payment.ts
```

It prints the health report and the settlement transaction hash from the
`PAYMENT-RESPONSE` header.

> **Live deployment / tx hash:** _pending_ — the production `wrangler deploy` and
> the one real Base-mainnet settlement require Cloudflare and CDP credentials and
> a funded wallet, which aren't available in the build environment. Once
> deployed, the workers.dev URL and the settled tx hash go here.

## License

MIT
