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
} from "./client.js";

const server = new McpServer({
  name: "@pelletfi/mcp",
  version: "2.1.0",
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
  "Paid · $0.05 USDC.e on Tempo (MPP 402 challenge, mppx handles automatically). Deep briefing for any Tempo TIP-20 stablecoin: peg spread vs pathUSD, TIP-403 policy posture, reserves + attestation, TIP-20 reward APY, fee economics, composite risk score with explainable sub-scores, DEX flow topology, role-holder enumeration, and a Claude-synthesized analyst note. Every numeric field is a direct on-chain measurement; null when unmeasured.",
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
  "Free · Current peg price vs pathUSD + 1h/24h/7d rolling aggregates (mean, stddev, max deviation in bps, seconds outside the 10bps/50bps bands) for a stablecoin. Supports historical time-travel via ?as_of=<ISO8601|epoch|relative>.",
  { address: z.string().describe("Stablecoin contract address (0x...)") },
  async ({ address }) => {
    const result = await getPegStats(address);
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
  "Free · Composite risk score (0–100, higher = more risk) with explainable sub-scores: peg_risk, peg_break_risk, supply_risk, policy_risk. Each sub-score cites its input measurements. Supports historical time-travel via ?as_of=.",
  { address: z.string().describe("Stablecoin contract address (0x...)") },
  async ({ address }) => {
    const result = await getRiskScore(address);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "get_reserves",
  "Free · Reserve / backing data: total Tempo-side backing in USD + per-entry breakdown (reserve_type, attestation_source, issuer, backing_model). Curated for tracked stables only; returns empty for others. Supports historical time-travel.",
  { address: z.string().describe("Stablecoin contract address (0x...)") },
  async ({ address }) => {
    const result = await getReserves(address);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// ── Start ──────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
