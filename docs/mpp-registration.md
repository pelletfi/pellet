# Pellet MPP Directory Registration

Status: **draft** — ready to submit via MPPScan + PR to `tempoxyz/mpp`.

## Submission paths

1. **MPPScan** (immediate discovery, no PR) — https://www.mppscan.com/register
2. **mpp.dev curated list** (PR to `tempoxyz/mpp`) — add the entry below to `schemas/services.ts`.

Do both. MPPScan indexes Pellet immediately for agents using `tempo wallet services`. The curated PR gets Pellet onto mpp.dev's human-facing directory alongside Alchemy, Nansen, etc.

## Service entry (for `schemas/services.ts`)

```typescript
{
  id: "pellet",
  name: "Pellet",
  url: "https://pelletfi.com",
  serviceUrl: "https://pelletfi.com",
  description:
    "Open-Ledger Interface (OLI) on Tempo. Every peg, policy, reserve, reward, flow, and risk signal for every TIP-20 stablecoin — measured directly on-chain, not estimated from oracles.",
  categories: ["blockchain", "data"],
  integration: "first-party",
  status: "active",
  tags: [
    "stablecoin",
    "tempo",
    "oli",
    "peg",
    "compliance",
    "tip-20",
    "tip-403",
    "flows",
    "risk",
    "reserves",
    "rewards",
    "fee-economics",
    "pathusd",
    "usdc.e",
  ],
  docs: {
    homepage: "https://pelletfi.com/docs",
    apiReference: "https://pelletfi.com/docs/api",
    llmsTxt: "https://pelletfi.com/docs/oli",
  },
  provider: { name: "Pellet Finance", url: "https://pelletfi.com" },
  realm: "pelletfi.com",
  intent: "charge",
  payments: [TEMPO_PAYMENT],
  docsBase: "https://pelletfi.com/docs/api",
  endpoints: [
    // ─── Free tier: catalog + lookups ──────────────────────────────────
    {
      route: "GET /api/v1/stablecoins",
      desc: "List every TIP-20 stablecoin on Tempo with live supply, policy, peg, and opted-in totals.",
    },
    {
      route: "GET /api/v1/stablecoins/{address}",
      desc: "Full detail on one stablecoin — supply, policy, headroom, peg vs pathUSD, opted-in supply.",
    },
    {
      route: "GET /api/v1/tokens",
      desc: "List or search Tempo tokens, sorted by 24h volume.",
    },
    {
      route: "GET /api/v1/tokens/{address}",
      desc: "Generic token detail — market data, safety scan, compliance, holder concentration.",
    },
    {
      route: "GET /api/v1/health",
      desc: "Tempo RPC connectivity check plus latest block height.",
    },
    {
      route: "GET /api/v1/system/health",
      desc: "Pellet ingestion + cron health — cursor lag, peg sample freshness.",
    },
    {
      route: "GET /api/v1/addresses/{address}",
      desc: "Address lookup — holdings, recent transfers, flow context across Tempo stables.",
    },

    // ─── Free tier: OLI time-series + analytics ────────────────────────
    {
      route: "GET /api/v1/stablecoins/{address}/peg",
      desc: "Current peg sample + 1h / 24h / 7d rolling aggregates. Supports `?as_of=` time travel.",
    },
    {
      route: "GET /api/v1/stablecoins/{address}/peg-events",
      desc: "Detected peg-break events timeline. Severity mild (>10bps ≥ 5min) or severe (>50bps ≥ 1min).",
    },
    {
      route: "GET /api/v1/stablecoins/{address}/risk",
      desc: "Composite risk score (0–100) with component breakdown: peg, peg-break, supply, policy.",
    },
    {
      route: "GET /api/v1/stablecoins/{address}/reserves",
      desc: "Reserve breakdown — total backing USD, per-reserve-type entries with attestation sources.",
    },
    {
      route: "GET /api/v1/stablecoins/{address}/rewards",
      desc: "TIP-20 reward precompile state — funders, opt-in supply, effective APY, redirect patterns.",
    },
    {
      route: "GET /api/v1/stablecoins/{address}/roles",
      desc: "Forensically-derived role holders — admins, issuers, pausers, burn-blockers.",
    },
    {
      route: "GET /api/v1/stablecoins/flows",
      desc: "Aggregate cross-stable flow graph. Hourly net flows between TIP-20 stables through the enshrined DEX.",
    },
    {
      route: "GET /api/v1/stablecoins/flow-anomalies",
      desc: "Recent 15-min windows where cross-stable flow exceeded 7-day baseline by ≥3σ.",
    },
    {
      route: "GET /api/v1/fee-economics/overview",
      desc: "Which stablecoins win as fee tokens on Tempo — election counts, distribution shares, validator preferences.",
    },

    // ─── Paid: deep briefing ───────────────────────────────────────────
    {
      route: "GET /api/v1/tokens/{address}/briefing",
      desc: "Full Pellet Briefing — market, safety, compliance, holders, identity, origin, peg/risk/reserves enrichment, plus a coverage & provenance ledger (block-pinned, per-section complete|partial flags, on-chain data lineage). 8 on-chain aggregators, null-on-unmeasured, no model synthesis.",
      amount: "200000", // 0.200 USDC.e — v2 pricing (2026-04-17)
    },
  ],
}
```

## Prerequisites

- ✅ `lib/mpp/server.ts` uses USDC.e as charge currency (ecosystem standard)
- ✅ `/api/v1/tokens/{address}/briefing` is live and MPP-gated on pathUSD → **needs re-verification after USDC.e switch**
- ✅ OpenAPI spec at `/api/openapi` documents the paid endpoint with `x-payment-info` pointing at USDC.e
- ✅ Docs: `/docs/oli`, `/docs/methodology`, `/docs/api` all live
- ✅ Service available at `https://pelletfi.com` with HTTPS
- ⬜ Live-test one paid briefing call via `tempo request` from CLI using USDC.e payment
- ⬜ MPPScan registration submitted
- ⬜ PR opened against `tempoxyz/mpp`

## Post-registration followups

- Add MPP gating to `risk`, `reserves`, `rewards`, `flows`, `peg-events` at the $0.005 – $0.01 tier once the briefing flow is proven in prod. Each becomes a paid endpoint via `briefingCharge`-style wrapper.
- Add a dedicated `/v1/compare/{address}` endpoint that runs Pellet + Codex head-to-head for a stable and returns both reads side by side — strongest differentiation surface for the OLI narrative.
- Add Zone Watch endpoints under `/v1/zones/...` as zones ship in production (per `project_open_ledger_positioning.md` three-tier roadmap).

## Competitive placement

After registration, `tempo wallet services --search stablecoin` should return Pellet first. Competing blockchain-data entries (Allium, Codex, Dune, Nansen) are multi-chain generalists — none Tempo-native stablecoin specialists. The category is unclaimed; registering first locks the slot.
