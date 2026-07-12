# RepoPulse MCP server

A small [Model Context Protocol](https://modelcontextprotocol.io) server that
exposes the paid RepoPulse API as tools any MCP host (Claude Desktop, Cursor, …)
can call. The paid tool performs the whole x402 **402 → sign → retry → settle**
flow for you, so from the agent's side it's just "call a tool, get a report."

## Tools

| Tool | Cost | Input | Returns |
| --- | --- | --- | --- |
| `get_repo_health` | **$0.01 USDC** (auto-paid via x402 on Base) | `repo` — `owner/name` | The full health report (score, grade, per-signal breakdown, flags, summary) + the settlement tx from the `PAYMENT-RESPONSE` header |
| `get_repo_pulse_schema` | free | — | The response JSON Schema + active weights |

## Configuration (env)

| Var | Required | Default | Purpose |
| --- | --- | --- | --- |
| `EVM_PRIVATE_KEY` | for the paid tool | — | `0x`-prefixed key of a **funded Base wallet** the server pays from. The free schema tool works without it. |
| `REPO_PULSE_URL` | no | `https://repo-pulse.dvd90.workers.dev` | Base URL of the deployed Worker |
| `X402_NETWORK` | no | `eip155:8453` | CAIP-2 network to pay on (Base mainnet) |

> The wallet here is the **payer** (it spends ~$0.01 per call), which is a
> different wallet from the `WALLET_ADDRESS` the API pays *out* to. Use a funded
> throwaway/agent wallet — never your main key.

## Run it standalone

```bash
npm ci
EVM_PRIVATE_KEY=0xYourFundedBaseKey npm run mcp
```

It speaks MCP over stdio (all logs go to stderr, so stdout stays clean for the
protocol).

## Add to Claude Desktop

Edit the config file:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

Add a `repo-pulse` entry (use an absolute path to this repo, and `tsx` to run the
TypeScript directly):

```json
{
  "mcpServers": {
    "repo-pulse": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/repo-pulse/mcp/repo-pulse-mcp.ts"],
      "env": {
        "EVM_PRIVATE_KEY": "0xYourFundedBaseKey",
        "REPO_PULSE_URL": "https://repo-pulse.dvd90.workers.dev"
      }
    }
  }
}
```

Restart Claude Desktop. You'll see a `repo-pulse` tool available — ask something
like *"What's the health score of honojs/hono?"* and it will call the paid tool,
settle $0.01 on Base, and return the report.

## Add to Cursor

In `.cursor/mcp.json` (project) or the global equivalent:

```json
{
  "mcpServers": {
    "repo-pulse": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/repo-pulse/mcp/repo-pulse-mcp.ts"],
      "env": { "EVM_PRIVATE_KEY": "0xYourFundedBaseKey" }
    }
  }
}
```

## Notes

- **Prefer a compiled entry for production hosts.** Running via `tsx` is fine for
  local use; for a packaged distribution, build to JS first and point `command`
  at `node`.
- **No key set?** `get_repo_health` returns a clear message telling you to set
  `EVM_PRIVATE_KEY`; `get_repo_pulse_schema` still works.
- **Testnet:** point `REPO_PULSE_URL` at a staging deploy and set
  `X402_NETWORK=eip155:84532` to exercise the flow on Base Sepolia.
