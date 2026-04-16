# Tempo ecosystem partner submission

URL: https://tempo.xyz/contact

## Form fields

- **First name:** Jake
- **Last name:** [your last name]
- **Email:** [your email]
- **Telegram:** [your handle]
- **Company name:** Pellet
- **Company website:** https://pelletfi.com

## Message (paste into the freeform field)

Hi team,

I'm Jake, building Pellet — open-ledger intelligence on Tempo.

We monitor every TIP-20 stablecoin end-to-end: peg health, supply dynamics, policy state, cross-stable flow anomalies, reserves, and role holders. Free public API, MCP server for AI agents, MPP-paid deep briefings.

A few specifics in case useful:
- Indexed every event from genesis (~36k+ across 12 stables)
- Sub-minute peg sampling via the enshrined DEX quoteSwap
- Forensic role discovery: we trace mint/burn transactions with debug_traceTransaction and verify with hasRole() to derive ISSUER addresses that aren't in any standard event log. We've already confirmed USDC.e ISSUER (0x8c76e2f6...) and USDT0 ISSUER (0xaf37e8b6...) — we believe Pellet is the only Tempo tool surfacing this data
- HMAC-signed webhooks for peg breaks and flow anomalies
- /api/v1/system/health public uptime probe
- @pelletfi/mcp on npm for AI agent integration

I'd love to be added to the Tempo ecosystem page under the Data category (alongside Allium, Artemis, Dune, Coingecko, etc.). Happy to provide whatever materials you need.

Live at https://pelletfi.com — explorer at https://pelletfi.com/explorer.

Thanks,
Jake
