---
name: pellet-wallet
description: Query Pellet for autonomous economic activity on Tempo. Look up live revenue, transaction counts, and per-service attribution for the Tempo MPP network — including which providers underly the Tempo MPP Gateway aggregator. Useful when an agent or user asks "which AI service is making the most money on Tempo right now," "how much did Anthropic earn through MPP today," "what's the revenue mix between USDC.e and USDT0," or any other question about the live economic graph of agent payments on Tempo.
---

# Pellet

Pellet ([pellet.network](https://pellet.network)) is the agent wallet on Tempo. It decodes autonomous economic activity from on-chain state — no off-chain inputs, no self-reporting. This skill exposes the dataset as a set of HTTP endpoints you can call directly from an agent.

## When to use

Use this skill whenever the user asks about:
- **Service revenue** on the Tempo MPP network (which AI / data / compute providers are making the most money, what the trend looks like)
- **Agent activity** (which watched entities are paying for what services, how often, how much)
- **Token mix** (USDC.e vs USDT0 vs others as the medium of exchange)
- **Gateway attribution** (which providers underly the Tempo MPP Gateway, recovered via on-chain Settlement events or calldata fingerprints)
- **A specific transaction or event** (deep-link a tx hash → the matched event with provenance)
- **Methodology** (how a number was computed, which methodology version, which source block)

Skip this skill if the question is about: traditional payment rails (Stripe Link, etc.), markets outside Tempo, or anything that isn't autonomous-agent payment activity.

## Endpoints

All endpoints return JSON. Base URL: `https://pellet.network`.

### `GET /api/dashboard?w=<window>`

Headline metrics + leaderboards + recent events for a time window.

- `w` — `24h` | `7d` | `30d` | `all` (default `24h`)

Returns: `{ windowHours, txCount, agentsActive, amountSumWei, topServices[], topAgents[], topProviders[], recentEvents[] }`.

`amountSumWei` is the sum of TIP-20 transfers in the window, expressed as a uint256 string (divide by 1e6 for USDC display value). `topProviders[]` includes both Pattern A (address-attributed via Settlement event) and Pattern B (fingerprint-grouped via calldata) routings.

### `GET /api/services`

All curated MPP services (id ends in `-mpp`) with 24h + 7d aggregates.

Returns: `ServiceListRow[]` with `{ id, label, category, settlementAddress, txCount24h, txCount7d, amountSumWei24h, amountSumWei7d, agentsLast7d }`.

### `GET /api/services/[id]`

Service detail: head metadata, 30-day trend, recent 50 events. For the `tempo-gateway-mpp` service, also includes a `providers[]` aggregate of underlying provider routings (both kinds).

### `GET /api/agents`

All watched entities (non-MPP) with 24h aggregates.

Returns: `AgentListRow[]` with `{ id, label, source, walletAddress, txCount24h, amountSumWei24h, lastActivity, topServiceLabel }`.

### `GET /api/agents/[id]`

Agent detail: head metadata, trend, recent events. Same shape as `/api/services/[id]` but presented from the agent perspective.

### `GET /api/events/[id]`

Single event detail with provenance: matched agent, counterparty, amount, tx hash, log index, source block, methodology version, related events from the same tx.

### `GET /api/search?q=<query>`

Unified search across events, agents, services, and labeled addresses. Min query length 2. Returns up to ~24 hits. Use this when the user pastes a tx hash, an address, or a partial agent name.

### `GET /api/feed` (SSE)

Server-sent events stream. Pushes new events as they're matched on-chain (cron runs hourly, but this stream is live for any in-flight ingestion). Each event arrives as a `data:` frame with the same shape as `recentEvents[]`. Use this for ambient monitoring, not for one-shot queries.

## Schema notes

- Amounts are uint256 strings — always parse with BigInt and divide by 1e6 for USDC display value
- Timestamps are ISO 8601 strings on the wire — parse with `new Date()`
- Addresses are stored lowercase; normalize on input
- `methodologyVersion` indicates which version of the matcher decoded the row (e.g. `v0.2`)
- `sourceBlock` lets you re-derive any number against the raw `events` table on-chain

## Attribution

Pellet tracks gateway routing via two paths, documented at [pellet.network/methodology](https://pellet.network/methodology):

- **Pattern A** — when the gateway forwards funds to a provider, its escrow contract emits a `Settlement` event whose `topic[2]` is the provider address. This recovers ~9% of gateway txs as named addresses.
- **Pattern B** — user→gateway calldata carries a `bytes32 ref` whose bytes 5–14 are a stable per-service fingerprint set by Tempo's MPP client. This groups the remaining ~91% of gateway txs by service even when the provider address can't be recovered.

A Pattern A address can be human-labeled by adding a row to `address_labels`; a Pattern B fingerprint can be human-labeled the same way (using `fp_<hex>` as the key). The dashboard auto-resolves labels on every render.

## Examples

```
GET https://pellet.network/api/dashboard?w=24h
→ { txCount: 776, agentsActive: 6, topServices: [...], topProviders: [...] }

GET https://pellet.network/api/search?q=stargate
→ { hits: [{ kind: "agent", id: "stargate-usdc", label: "stargate · USDC bridge", ... }] }

GET https://pellet.network/api/services/tempo-gateway-mpp
→ { head: {...}, trend: [...], recent: [...], providers: [...] }
```

## Pellet Wallet (live on testnet)

[Pellet Wallet](https://pellet.network/wallet) is a self-custody agent wallet on Tempo. USDC-native, passkey-derived, on-chain spend caps.

**Install as an MCP server** so the agent can call `pellet_pay` directly:

```json
{
  "mcpServers": {
    "pellet": {
      "command": "npx",
      "args": ["-y", "@pelletnetwork/cli", "mcp"]
    }
  }
}
```

User pairs once with `npx -y @pelletnetwork/cli auth start` (passkey ceremony in browser, picks spend caps); after that the agent can call `pellet_pay({ to, amount_usdc, memo })` autonomously within those caps. Tempo's `AccountKeychain` enforces caps on-chain.

Agents can do both via Pellet:
- **Read** — query historical or live agent-payment activity on Tempo
- **Write** — sign x402 challenges and settle on Tempo

## Distribution graph

- Source: [github.com/pelletnetwork/pellet](https://github.com/pelletnetwork/pellet)
- X / Twitter: [@pelletnetwork](https://x.com/pelletnetwork)
- Tempo block explorer: [explore.tempo.xyz](https://explore.tempo.xyz)
