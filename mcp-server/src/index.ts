#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  searchTokens,
  lookupToken,
  analyzeToken,
  getStablecoins,
  getStablecoinFlows,
  getPegStats,
  getPegEvents,
  getRiskScore,
  getReserves,
  getRewards,
  getRoleHolders,
  getFlowAnomalies,
  simulateTransfer,
  lookupWalletIntelligence,
  quickcheckAddress,
} from "./client.js";

const server = new McpServer({
  name: "@pelletfi/mcp",
  version: "2.5.0",
});

// ── Tools ──────────────────────────────────────────────────────────────────────

server.tool(
  "search_token",
  "Free · Search Tempo tokens by symbol, name, or 0x address. Returns top matches with address + on-chain name/symbol. Read before lookup_token if you only have a fragment.",
  { query: z.string().describe("Token symbol, name, or address to search for") },
  async ({ query }) => {
    const result = await searchTokens(query);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "lookup_token",
  "Free · Market data, safety flags, TIP-20 compliance state, and holder-concentration for any Tempo token. Lighter-weight than analyze_token — no paid pipeline, no LLM synthesis. Fields are nullable when a measurement is unavailable (OLI discipline: null ≠ zero).",
  { address: z.string().describe("Token contract address (0x...)") },
  async ({ address }) => {
    const result = await lookupToken(address);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "analyze_token",
  "Paid · USDC.e on Tempo (MPP 402 challenge, mppx handles automatically). Deep briefing for any Tempo TIP-20 stablecoin: peg spread vs pathUSD, TIP-403 policy posture, reserves + attestation, TIP-20 reward APY, fee economics, composite risk score with explainable sub-scores, DEX flow topology, role-holder enumeration, and a coverage & provenance ledger (per-section complete|partial|unavailable flags, block-pinned reproducibility, and the on-chain data lineage for every section). Every numeric field is a direct on-chain measurement; null when unmeasured. No model synthesis.",
  { address: z.string().describe("Token contract address (0x...)") },
  async ({ address }) => {
    const result = await analyzeToken(address);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "get_stablecoins",
  "Free · Full matrix of every tracked Tempo stablecoin: supply, policy state, spread vs pathUSD, opted-in supply, and (when available) composite risk score. Each row includes a coverage field — complete/partial/unavailable — so you can tell measured values from missing ones.",
  {},
  async () => {
    const result = await getStablecoins();
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "get_stablecoin_flows",
  "Free · Net directional flows between tracked Tempo stablecoins, routed via the enshrined DEX precompile. Hourly granularity, window up to 7 days. Useful for detecting capital rotation between stables and as an early signal before peg breaks.",
  {
    hours: z
      .number()
      .optional()
      .default(24)
      .describe("Lookback window in hours (default 24, max 168)"),
  },
  async ({ hours }) => {
    const result = await getStablecoinFlows(hours ?? 24);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "get_peg_stats",
  "Free · Current peg price vs pathUSD + 1h/24h/7d rolling aggregates (mean, stddev, max deviation in bps, seconds outside the 10bps/50bps bands) for a stablecoin. Pass `as_of` for a historical snapshot (ISO-8601, Unix-epoch seconds, or relative like `-1h`).",
  {
    address: z.string().describe("Stablecoin contract address (0x...)"),
    as_of: z
      .string()
      .optional()
      .describe("Optional historical snapshot timestamp (ISO-8601, epoch, or relative like -1h)."),
  },
  async ({ address, as_of }) => {
    const result = await getPegStats(address, as_of);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "get_peg_events",
  "Free · Timeline of detected peg-break events (severity: mild = >10bps for ≥5min, severe = >50bps for ≥1min) with duration, block range, and ongoing flag. Supports historical time-travel.",
  {
    address: z.string().describe("Stablecoin contract address (0x...)"),
    limit: z
      .number()
      .optional()
      .default(20)
      .describe("Max number of events to return (default 20, max 100)"),
  },
  async ({ address, limit }) => {
    const result = await getPegEvents(address, limit ?? 20);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "get_risk_score",
  "Free · Composite risk score (0–100, higher = more risk) with explainable sub-scores: peg_risk, peg_break_risk, supply_risk, policy_risk. Each sub-score cites its input measurements. Pass `as_of` for a historical snapshot.",
  {
    address: z.string().describe("Stablecoin contract address (0x...)"),
    as_of: z.string().optional().describe("Optional historical snapshot timestamp."),
  },
  async ({ address, as_of }) => {
    const result = await getRiskScore(address, as_of);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "get_reserves",
  "Free · Reserve / backing data: total Tempo-side backing in USD + per-entry breakdown (reserve_type, attestation_source, issuer, backing_model). Curated for tracked stables only; returns empty for others. Pass `as_of` for a historical snapshot.",
  {
    address: z.string().describe("Stablecoin contract address (0x...)"),
    as_of: z.string().optional().describe("Optional historical snapshot timestamp."),
  },
  async ({ address, as_of }) => {
    const result = await getReserves(address, as_of);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "get_rewards",
  "Free · TIP-20 reward distribution + effective APY for a stablecoin. Returns effective_apy_pct (annualized from last 7d distributed / opted-in supply), opted-in supply, distribution_count, per-funder attribution, and recent distributions. APY is null when no live data or no opt-ins — never inferred as zero. Pass `as_of` for a historical snapshot.",
  {
    address: z.string().describe("Stablecoin contract address (0x...)"),
    as_of: z.string().optional().describe("Optional historical snapshot timestamp."),
  },
  async ({ address, as_of }) => {
    const result = await getRewards(address, as_of);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "get_role_holders",
  "Free · Forensic role-holder enumeration for a stablecoin. Returns every address that holds ISSUER_ROLE / DEFAULT_ADMIN_ROLE / PAUSE_ROLE / UNPAUSE_ROLE / BURN_BLOCKED_ROLE, derived by tracing on-chain mint/burn/burnBlocked txs and verifying each caller via hasRole(). TIP-20 doesn't emit role-change events, so this is the only current path to the complete role set. Coverage is best-effort and reflects the block range the role-holder cron has scanned.",
  { address: z.string().describe("Stablecoin contract address (0x...)") },
  async ({ address }) => {
    const result = await getRoleHolders(address);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "get_flow_anomalies",
  "Free · Cross-stable flow anomalies — 15-minute windows where net flow between two stables exceeded the 7-day rolling baseline by ≥ Z_THRESHOLD sigmas. Returns the edge (from_token, to_token), window bounds, observed/baseline flow, z-score, and tx count. Useful as early-warning for capital rotation before peg breaks show in price. Agents subscribed to flow_anomaly.detected webhook get these in real time.",
  {},
  async () => {
    const result = await getFlowAnomalies();
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "lookup_wallet_intelligence",
  "Free · Single-endpoint wallet intelligence for any Tempo address. Returns curated + forensic labels, ERC-8004 agent status (is this an agent? how many agent NFTs owned?), role holdings across every tracked TIP-20 stablecoin (issuer / minter / pauser / burn-blocked), and derived summaries (is_issuer_of, is_minter_of, etc.). Unique to Pellet on Tempo — combines TIP-403 role forensics with ERC-8004 identity registry reads in one call. Every field has explicit coverage; null is never inferred as absence.",
  {
    address: z.string().describe("Any Tempo address (0x-prefixed, 42 hex chars). Can be EOA, contract, or ERC-8004 agent."),
  },
  async ({ address }) => {
    const result = await lookupWalletIntelligence(address);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.tool(
  "quickcheck_address",
  "Free · Fast transaction-time precheck for any Tempo address. Returns compact boolean flags (is_issuer_of_any / is_minter_of_any / is_default_admin_of_any / is_pauser_of_any / is_unpauser_of_any / is_burn_blocked_by_any / is_policy_admin_of_any / is_privileged) plus label metadata + role/admin counts. Pure DB read — no RPC, no pipeline. Target latency < 50ms, designed for agents in the transfer-decision critical path. Call lookup_wallet_intelligence when you need per-stable breakdown or ERC-8004 agent status.",
  { address: z.string().describe("Any Tempo address (0x-prefixed, 42 hex chars).") },
  async ({ address }) => {
    const result = await quickcheckAddress(address);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

server.tool(
  "simulate_transfer",
  "Free · Pre-trade compliance oracle. Given a proposed TIP-20 transfer {from, to, token, amount?}, predict statically whether it would revert under TIP-403 policy — without sending a transaction. Returns willSucceed (true/false/null), policy id/type/admin, per-party authorization, optional balance check, and a human-readable reason. Null willSucceed means 'unknown' (coverage:partial); never interpret null as false. Call before submitting a transfer to avoid wasting gas on Unauthorized() reverts.",
  {
    from: z.string().describe("Sender address (0x-prefixed, 42 hex chars)"),
    to: z.string().describe("Recipient address (0x-prefixed, 42 hex chars)"),
    token: z
      .string()
      .describe("TIP-20 token contract address (Tempo stables start with 0x20c0…)"),
    amount: z
      .string()
      .optional()
      .describe(
        "Optional raw uint256 decimal string (e.g. '1000000' = 1 USDC.e at 6 decimals). If provided, sender balance is also checked.",
      ),
  },
  async ({ from, to, token, amount }) => {
    const result = await simulateTransfer(from, to, token, amount);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
);

// ── Start ──────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
