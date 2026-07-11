# awesome-x402 submission snippet

PR-ready entry for the [`awesome-x402`](https://github.com/coinbase/awesome-x402)
list. Add under the **Services / APIs** section (adjust the URL once deployed):

```markdown
- [RepoPulse](https://repo-pulse.<subdomain>.workers.dev) — Deterministic 0–100
  health score for any public GitHub repository, with a per-signal breakdown
  (commit recency, release cadence, issue hygiene, PR flow, bus factor, CI,
  tests, docs, dependency freshness). $0.01 USDC per call on Base
  (`eip155:8453`), Bazaar-discoverable. `GET /v1/health?repo=owner/name`.
```

## Bazaar discovery

The service declares the Bazaar discovery extension on `/v1/health` with full
input/output JSON Schemas and per-parameter descriptions, so it is indexable via
the CDP discovery API once it has served at least one paid request through the
CDP facilitator. No separate registration step is required — discovery metadata
rides along in the 402 `PAYMENT-REQUIRED` payload and the facilitator catalogs it.
