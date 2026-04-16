# Distribution submission cheat-sheet

Copy-paste copy for every directory we should be on. Listed in priority order.

---

## 1. Tempo ecosystem (highest leverage)

**URL:** https://tempo.xyz/contact
**Status:** ❌ not listed
**Pitch:** see `docs/tempo-partner-pitch.md`

---

## 2. x402scan

**URL:** https://www.x402scan.com
**Status:** unclear — verify by searching for "pellet" or "pelletfi"
**How to list:** typically via OpenAPI spec discovery — service must publish `/api/openapi` (we do at `https://pelletfi.com/api/openapi`) and have an MPP-paid endpoint that x402scan crawls

If not listed, ping the x402scan team / GitHub repo to add Pellet.

---

## 3. MCP server directories

### a. Awesome MCP Servers (GitHub)
**URL:** https://github.com/punkpeye/awesome-mcp-servers
**How to list:** PR adding entry under appropriate section (likely "Finance & Crypto" or "Data")

**PR entry to add:**

```markdown
- [pellet](https://github.com/pelletfi/pellet) - Open-ledger intelligence on Tempo. Peg health, risk scores, reserves, role holders, peg-break detection. Free + MPP-paid tools.
```

### b. mcpservers.org (or similar registries)
Search "pellet" / "tempo" — submit if missing. Typical form: name, description, npm package, GitHub URL, tools list.

**Description (200 chars):**
> Open-ledger intelligence on Tempo. Live peg health, composite risk scores, backing reserves, forensically-derived role holders, peg-break events. Free tools + MPP-paid deep briefings.

**Tools list:**
- search_token, lookup_token, analyze_token (paid)
- get_stablecoins, get_stablecoin_flows
- get_peg_stats, get_peg_events, get_risk_score, get_reserves

---

## 4. Farcaster channels

Post a short native cast in each (don't just paste the launch thread — write something channel-relevant).

### /tempo channel
> Pellet just shipped a forensic role discovery pipeline for Tempo TIP-20 stables.
>
> Tempo's precompile doesn't emit role events or expose enumeration, so we trace every mint/burn tx with debug_traceTransaction and verify with hasRole().
>
> Already confirmed USDC.e ISSUER = 0x8c76e2f6... and USDT0 ISSUER = 0xaf37e8b6...
>
> Try it: https://pelletfi.com/explorer

### /stablecoins channel
> Stablecoin risk intelligence on Tempo.
>
> Composite risk scores, peg-break detection, cross-stable flow anomalies, reserves with attestation links — all free API.
>
> 12 stables monitored continuously. Webhooks for peg events.
>
> https://pelletfi.com

### /defi channel
> Built open-ledger intelligence on Tempo (the Stripe-backed L1).
>
> Indexes every TIP-20 event from genesis. Detects peg breaks. Scores risk. Maps cross-stable flows.
>
> Free tier + MPP-paid deep briefings. MCP server for AI agents.
>
> https://pelletfi.com

---

## 5. DefiLlama protocol listing

**URL:** https://defillama.com/submit-project
**Status:** ❌ not listed
**Category:** Stablecoins or Analytics
**Required:** project name, URL, description, twitter handle, GitHub, chain (Tempo)

**Description:**
> Pellet is open-ledger intelligence on Tempo. Live peg health, composite risk scores, backing reserves, role holders, and cross-stable flow anomaly detection — refreshed continuously across all 12 TIP-20 stables.

---

## 6. Tempo Farcaster mini-app directory (if exists)

Tempo + Farcaster integration is mentioned in the ecosystem partners. If they publish a Farcaster Frames / mini-app directory specifically for Tempo apps, Pellet's explorer would be a natural fit.

Reach out via the same `tempo.xyz/contact` form to ask about visibility in their Frame ecosystem.

---

## Order of execution

1. ✅ Tempo ecosystem (already drafted)
2. Farcaster channel posts (free, immediate, native to the audience)
3. Awesome MCP Servers PR (15 min, durable)
4. DefiLlama submission (10 min, broad reach)
5. x402scan verification + listing if needed

Total time: ~45 min once Tempo submission is done.
