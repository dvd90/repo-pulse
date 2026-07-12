/**
 * RepoPulse MCP server — a bridge that exposes the paid RepoPulse HTTP API as
 * Model Context Protocol tools, so any MCP host (Claude Desktop, Cursor, etc.)
 * can score a GitHub repo and pay for it automatically via x402.
 *
 * It does NOT re-implement scoring; it calls the deployed Worker. The paid tool
 * uses `@x402/fetch` + the operator's wallet to perform the 402 → sign → retry
 * flow transparently, so the agent just "calls a tool" and gets a report.
 *
 * Transport: stdio. IMPORTANT: on stdio, stdout is the protocol channel — all
 * diagnostics go to stderr (console.error) only.
 *
 * Configure via env (e.g. in your MCP host's server config):
 *   REPO_PULSE_URL   Base URL of the deployed Worker
 *                    (default https://repo-pulse.dvd90.workers.dev)
 *   X402_NETWORK     CAIP-2 network to pay on (default eip155:8453 = Base)
 *   EVM_PRIVATE_KEY  0x-prefixed key of a funded Base wallet. Required only for
 *                    the paid tool; the free schema tool works without it.
 *
 * Run: `npm run mcp`  (or `npx tsx mcp/repo-pulse-mcp.ts`)
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";

const BASE_URL = (process.env.REPO_PULSE_URL ?? "https://repo-pulse.dvd90.workers.dev").replace(
  /\/$/,
  "",
);
const NETWORK = process.env.X402_NETWORK ?? "eip155:8453";
const PRIVATE_KEY = process.env.EVM_PRIVATE_KEY;

/** Lazily build a payment-capable fetch; null (with a reason) if no key is set. */
function makePayingFetch(): { fetch: typeof fetch; address: string } | { error: string } {
  if (!PRIVATE_KEY) {
    return {
      error:
        "No EVM_PRIVATE_KEY configured. Set it (a funded Base wallet, 0x-prefixed) in this MCP server's environment to enable paid calls.",
    };
  }
  try {
    const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);
    const paying = wrapFetchWithPaymentFromConfig(fetch, {
      schemes: [{ network: NETWORK, client: new ExactEvmScheme(account) }],
    });
    return { fetch: paying, address: account.address };
  } catch (e) {
    return { error: `Invalid EVM_PRIVATE_KEY: ${e instanceof Error ? e.message : "unknown"}` };
  }
}

function textResult(text: string, isError = false) {
  return { content: [{ type: "text" as const, text }], isError };
}

const server = new McpServer({ name: "repo-pulse", version: "1.0.0" });

// Paid tool: score a repository (pays $0.01 USDC per call via x402).
server.tool(
  "get_repo_health",
  "Get a deterministic 0-100 health score for a public GitHub repository, with a per-signal breakdown (commit recency, release cadence, issue hygiene, PR flow, bus factor, CI, tests, docs, dependency freshness), an A-F grade, flags, and a one-line summary. Costs $0.01 USDC per call, paid automatically via x402 on Base. Input: the repo as 'owner/name'.",
  { repo: z.string().describe("GitHub repository as 'owner/name', e.g. 'honojs/hono'.") },
  async ({ repo }: { repo: string }) => {
    const payer = makePayingFetch();
    if ("error" in payer) return textResult(payer.error, true);

    const url = `${BASE_URL}/v1/health?repo=${encodeURIComponent(repo)}`;
    try {
      console.error(`[repo-pulse] paying from ${payer.address} → ${url}`);
      const res = await payer.fetch(url, { method: "GET" });
      const body = await res.text();
      if (!res.ok) {
        return textResult(`RepoPulse returned HTTP ${res.status}: ${body}`, true);
      }
      const settlement =
        res.headers.get("payment-response") ?? res.headers.get("x-payment-response");
      const parsed: unknown = JSON.parse(body);
      const data = (parsed as { data?: unknown }).data ?? parsed;
      const out = { report: data, ...(settlement ? { paymentResponseHeader: settlement } : {}) };
      return textResult(JSON.stringify(out, null, 2));
    } catch (e) {
      return textResult(`Request failed: ${e instanceof Error ? e.message : "unknown"}`, true);
    }
  },
);

// Free tool: fetch the response JSON Schema + active weights (no payment).
server.tool(
  "get_repo_pulse_schema",
  "Fetch the RepoPulse response JSON Schema and the active signal weights. Free — no payment required. Useful to understand the exact shape of get_repo_health output.",
  {},
  async () => {
    try {
      const res = await fetch(`${BASE_URL}/v1/schema`);
      const body = await res.text();
      if (!res.ok) return textResult(`HTTP ${res.status}: ${body}`, true);
      return textResult(body);
    } catch (e) {
      return textResult(`Request failed: ${e instanceof Error ? e.message : "unknown"}`, true);
    }
  },
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[repo-pulse] MCP server ready · target ${BASE_URL} · network ${NETWORK}`);
}

main().catch((err) => {
  console.error("[repo-pulse] fatal:", err);
  process.exit(1);
});
