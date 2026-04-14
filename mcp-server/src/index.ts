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
  "Search for tokens on Tempo by symbol or address",
  { query: z.string().describe("Token symbol, name, or address to search for") },
  async ({ query }) => {
    const result = await searchTokens(query);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "lookup_token",
  "Get market data, safety flags, and compliance for a Tempo token",
  { address: z.string().describe("Token contract address (0x...)") },
  async ({ address }) => {
    const result = await lookupToken(address);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "analyze_token",
  "Deep briefing: origin, holders, compliance, analyst note ($0.05 pathUSD)",
  { address: z.string().describe("Token contract address (0x...)") },
  async ({ address }) => {
    const result = await analyzeToken(address);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "get_stablecoins",
  "Full Tempo stablecoin matrix",
  {},
  async () => {
    const result = await getStablecoins();
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "get_stablecoin_flows",
  "Net directional flows between Tempo stablecoins",
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
  "Current peg price + 1h/24h/7d aggregates (mean, stddev, max deviation, time outside peg) for a stablecoin",
  { address: z.string().describe("Stablecoin contract address (0x...)") },
  async ({ address }) => {
    const result = await getPegStats(address);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "get_peg_events",
  "Timeline of detected peg-break events (mild >10bps for 5min, severe >50bps for 1min)",
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
  "Composite risk score (0-100, higher = more risk) with explainable components: peg_risk, peg_break_risk, supply_risk, policy_risk",
  { address: z.string().describe("Stablecoin contract address (0x...)") },
  async ({ address }) => {
    const result = await getRiskScore(address);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

server.tool(
  "get_reserves",
  "Reserve / backing data: total backing USD + per-component breakdown (reserve type, attestation source, issuer)",
  { address: z.string().describe("Stablecoin contract address (0x...)") },
  async ({ address }) => {
    const result = await getReserves(address);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// ── Start ──────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
