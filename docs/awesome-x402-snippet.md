# awesome-x402 submission (ready to open)

A PR-ready entry for [`xpaysh/awesome-x402`](https://github.com/xpaysh/awesome-x402)
(matches its `🏭 Production Implementations` format). The same one-liner works for
other x402 lists such as [`Merit-Systems/awesome-x402`](https://github.com/Merit-Systems/awesome-x402).

> **Before submitting:** confirm the deployed URL responds (`/healthz` → 200,
> `/v1/health` → 402) and, ideally, land one real Base settlement first so the
> listing is demonstrably live.

## List entry

Add under **🏭 Production Implementations → Data & Social APIs**:

```markdown
- [RepoPulse](https://repo-pulse.dvd90.workers.dev) - Deterministic 0–100 health score for any public GitHub repository, with a nine-signal breakdown (commit recency, release cadence, issue hygiene, PR flow, bus factor, CI, tests, docs, dependency freshness), A–F grade and flags. $0.01 USDC on Base, no account or key. Bazaar-discoverable and MCP-ready. ([GitHub](https://github.com/dvd90/repo-pulse))
```

## PR title

```
Add RepoPulse — GitHub repo health score API ($0.01 x402 on Base)
```

## PR body

```markdown
### What

[RepoPulse](https://repo-pulse.dvd90.workers.dev) is a pay-per-call API that
returns a deterministic 0–100 health score for any public GitHub repository,
with a per-signal breakdown, an A–F grade, flags, and a one-line summary.

- **Price:** $0.01 USDC per call, x402 `exact` scheme on Base (`eip155:8453`).
- **Auth:** none — the wallet is the identity. Unpaid requests get a spec-correct
  402 with payment requirements in the `PAYMENT-REQUIRED` header.
- **Discovery:** ships the x402 Bazaar extension with full input/output JSON
  Schemas and per-parameter descriptions.
- **MCP:** a bundled MCP server exposes it as a native tool for agent hosts.
- **Deterministic:** identical repo state ⇒ identical score. No LLM in the
  serving path. Runs on Cloudflare Workers.

### Try it

```bash
curl https://repo-pulse.dvd90.workers.dev/v1/schema
curl -i "https://repo-pulse.dvd90.workers.dev/v1/health?repo=honojs/hono"   # 402
```

### Links
- Live: https://repo-pulse.dvd90.workers.dev
- Source: https://github.com/dvd90/repo-pulse
- Schema: https://repo-pulse.dvd90.workers.dev/v1/schema

Added one entry under Production Implementations; happy to adjust the section or
wording to match your conventions.
```

## Bazaar (CDP) discovery

No separate registration is required: the discovery metadata rides in the 402
`PAYMENT-REQUIRED` payload, and the CDP facilitator catalogs the endpoint after
its first paid call through CDP. Once a real settlement lands, add the tx hash to
the project README as proof-of-life.
