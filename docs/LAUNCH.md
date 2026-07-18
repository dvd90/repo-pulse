# RepoPulse launch playbook

The distribution plan, in execution order. The x402 ecosystem steps come first
because they're mostly automatic and the ecosystem is small enough that being
listed *is* the marketing; the human-facing launch (Show HN) comes last and
uses "already discoverable by agents" as part of the story.

**Gate for everything below:** the Worker is deployed, `/healthz` → 200,
`/v1/health` → spec-correct 402, and ideally one real Base mainnet settlement
has landed (record the tx hash in the README as proof-of-life). Ship at
slightly-embarrassing quality — but ship something that answers.

## Phase 0 — architecture that markets itself (done)

Already built; listed here so nobody re-does it:

- [x] **Bazaar discovery extension** with full input/output JSON Schemas and
      per-parameter descriptions (`src/lib/x402/bazaar.ts`). The CDP
      facilitator catalogs the endpoint after its first paid call — the buyers
      in this ecosystem are largely agents doing semantic search over the CDP
      catalog, so rich schemas are the SEO of this economy. No separate
      registration step.
- [x] **MCP server** (see `docs/` MCP guide) — agent hosts can pay-and-call
      RepoPulse as a native tool. Doubles the discovery surface.
- [x] **No API keys, free schema endpoint** (`/v1/schema`), $0.01/call —
      matches the pattern that recurs in successful x402 listings
      ($0.001–$0.05, no signup, self-describing).
- [x] **Landing page** at the root for humans who click through.

## Phase 1 — auto-index directories (~30 min, once live)

Machine-verified listings; submit the deployed URL and they self-validate:

- [ ] **x402scan** — submit at `x402scan.com/resources/register`. It probes
      the URL; a valid 402 schema gets added automatically.
- [ ] **x402-list.com** — same idea, with live uptime monitoring.
- [ ] **Onyx Bazaar** — nothing to do: it indexes every paid service via the
      CDP discovery API (refreshed ~15 min). Appears automatically once real
      transactions flow through CDP — another reason to land the first paid
      call early.
- [ ] **Agentic.Market**, **Pay.sh**, **app.ampersend.ai/discover** — the
      x402 Foundation README points people at these; submit to each.

## Phase 2 — curated lists (PRs, human review)

- [ ] PR to **xpaysh/awesome-x402** and **Merit-Systems/awesome-x402** —
      entry text, PR title, and PR body are ready in
      [`docs/awesome-x402-snippet.md`](./awesome-x402-snippet.md).
- [ ] **gold-402** (editorial directory with verified badges for
      production-confirmed services) — apply once a mainnet settlement exists;
      the verified badge is worth the wait.

## Phase 3 — the human layer

- [ ] Post in the **x402 Discord** (link from x402-foundation/x402) —
      show-and-tell channel, not a sales pitch: what it does, price, curl
      example, what feedback you want.
- [ ] Tag **@coinbasedev / CDP** and **@CloudflareDev** when announcing —
      both actively showcase things built on x402, and Workers + Hono + CDP
      facilitator is the showcase-friendly stack. Being early in a small pond
      means the pond promotes you.
- [ ] Pitch **x402daily.xyz** a "built on Cloudflare Workers" story once
      there are real Bazaar transactions to point at.

## Phase 4 — Show HN (the one-time spike)

Post **Tuesday–Thursday, morning US time**. The launch is ~4 hours of
posting; the value is in the follow-up — answer every single comment.

**Title:**

```
Show HN: RepoPulse – pay-per-call GitHub repo health scores over x402
```

**Text (first comment / body):**

```
I built a small API that gives any public GitHub repo a deterministic
0–100 health score with a nine-signal breakdown (commit recency, release
cadence, issue hygiene, PR flow, bus factor, CI, tests, docs, dependency
freshness) and an A–F grade.

The part I actually wanted to explore: there's no signup, no API key, no
Stripe. Each call costs $0.01 USDC, paid per-request over x402 — the HTTP
402 micropayment protocol Coinbase and Cloudflare are pushing. An unpaid
request returns a spec-correct 402 with payment requirements; your client
(or your agent) pays and retries. The wallet is the identity.

It runs on Cloudflare Workers + Hono, is deterministic (same repo state ⇒
same score, no LLM in the serving path), and ships with an MCP server so
Claude/agent hosts can pay-and-call it as a native tool. It's already
indexed in the x402 Bazaar, so autonomous agents can discover and call it
without a human in the loop — which is the experiment: what does an API
business look like when your customers are mostly agents?

Free bits: GET /v1/schema (response schema + scoring weights), and the
scoring methodology is open source.

Try it:
  curl https://repo-pulse.dvd90.workers.dev/v1/schema
  curl -i "https://repo-pulse.dvd90.workers.dev/v1/health?repo=honojs/hono"   # 402

Happy to answer anything about x402, Workers, or the scoring model —
especially interested in whether the signals match your intuition of
"healthy".
```

Same 48-hour burst, secondary posts: **r/SideProject**, **r/webdev**,
**lobste.rs**, **dev.to**, **Product Hunt** (weaker for pure dev APIs, but
free). Don't spread the posting across weeks — concentrate it so momentum
compounds, then spend the following days in the comment threads.

## Phase 5 — compounding channel (pick ONE, weekly)

**Writing.** One solid technical post per launch:
*"How I built a paid API on Cloudflare Workers with x402"* — genuinely
searchable content right now because almost nobody has written it. Post on
your own domain, syndicate to dev.to, submit to HN. Doubles as SEO: in six
months this can own the search results for "x402 tutorial".

(Alternative is build-in-public on X — but one channel done weekly beats
four done sporadically. Don't add a newsletter or YouTube.)

## Phase 6 — product-embedded distribution (next feature, not pre-launch)

Free README badge: `![repo health](https://repo-pulse.dvd90.workers.dev/badge/{owner}/{repo})`
— every badge is a permanent backlink and ad; the free badge markets the paid
API (the Shields.io play). Worth a milestone of its own; don't block the
launch on it.

## The part you'll want to skip but shouldn't

DM or email **20 people** who might actually use it: devs writing about x402,
maintainers of API-monetization tools, people who complained on HN/Reddit
about Stripe overhead for micro-APIs. Not to sell — to ask *"does this solve
anything for you?"* Ten replies teach more than a thousand landing-page
visitors.

## First month at 5–10 hrs/week

| Week | Focus |
| --- | --- |
| 1–2 | Deploy, land one real Base settlement, Phase 1 directory submissions, awesome-x402 PRs |
| 3 | Write the technical post; prep the Show HN draft; Discord + protocol-team pings |
| 4 | Launch everywhere in a 48-hour burst, then answer every single comment |

One warning: the temptation will be to keep polishing until it "deserves" a
launch. HN forgives rough edges; it doesn't forgive vaporware — but nobody
sees the thing you never posted.
