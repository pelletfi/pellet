# @pelletfi/mcp

Pellet's MCP server — gives AI agents access to live open-ledger intelligence on the Tempo blockchain.

```bash
npm install -g @pelletfi/mcp
```

## Configure

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "pellet": {
      "command": "npx",
      "args": ["-y", "@pelletfi/mcp"],
      "env": {
        "EVM_PRIVATE_KEY": "0x..."
      }
    }
  }
}
```

`EVM_PRIVATE_KEY` is optional. Without it, only free endpoints work. With it, paid endpoints (briefings) auto-settle via MPP — make sure the wallet holds pathUSD.

## Tools

### Free
| Tool | Returns |
| --- | --- |
| `search_token` | Token search by symbol or address |
| `lookup_token` | Market data, safety flags, compliance for a token |
| `get_stablecoins` | Full Tempo stablecoin matrix |
| `get_stablecoin_flows` | Net directional flows between stables |
| `get_peg_stats` | Current peg + 1h/24h/7d aggregates per stable |
| `get_peg_events` | Detected peg-break events (mild + severe) |
| `get_risk_score` | Composite risk score 0–100 with components |
| `get_reserves` | Backing breakdown — total USD + per-component sources |

### Paid (MPP — pathUSD on Tempo)
| Tool | Cost |
| --- | --- |
| `analyze_token` | $0.05 deep briefing: origin, holders, compliance, analyst note (now incorporates peg + risk + reserves data when applicable) |

## Example session

> "What's the current peg health on USDC.e?"

Claude calls `get_peg_stats` for `0x20c000000000000000000000b9537d11c60e8b50` and answers with mean price, stddev, and time-outside-peg windows.

> "Are there any active peg-break events?"

Claude calls `get_peg_events` across stables, filters for `ongoing: true`, summarizes.

> "Give me a deep analysis of pathUSD."

Claude calls `analyze_token`, which auto-settles the $0.05 micropayment via your `EVM_PRIVATE_KEY`. Returns a briefing that quotes real peg stats, risk score, and Tempo-side backing.

## Auth modes

| Mode | Required env | Free endpoints | Paid endpoints |
| --- | --- | --- | --- |
| Anonymous | none | ✅ | ❌ (returns 402) |
| MPP | `EVM_PRIVATE_KEY` | ✅ | ✅ (auto-pays) |

## Endpoints

All tools wrap the Pellet REST API at `https://pelletfi.com/api/v1`. Full schema docs: [pelletfi.com/docs/api](https://pelletfi.com/docs/api).

## Links

- [Documentation](https://pelletfi.com/docs)
- [Webhooks (HMAC-signed event delivery)](https://pelletfi.com/docs/webhooks)
- [Status](https://pelletfi.com/status)

MIT License.
