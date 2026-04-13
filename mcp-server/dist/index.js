#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { searchTokens, lookupToken, analyzeToken, getStablecoins, getStablecoinFlows, } from "./client.js";
const server = new McpServer({
    name: "@pelletfi/mcp",
    version: "1.0.0",
});
// ── Tools ──────────────────────────────────────────────────────────────────────
server.tool("search_token", "Search for tokens on Tempo by symbol or address", { query: z.string().describe("Token symbol, name, or address to search for") }, async ({ query }) => {
    const result = await searchTokens(query);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
});
server.tool("lookup_token", "Get market data, safety flags, and compliance for a Tempo token", { address: z.string().describe("Token contract address (0x...)") }, async ({ address }) => {
    const result = await lookupToken(address);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
});
server.tool("analyze_token", "Deep briefing: origin, holders, compliance, analyst note ($0.05 pathUSD)", { address: z.string().describe("Token contract address (0x...)") }, async ({ address }) => {
    const result = await analyzeToken(address);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
});
server.tool("get_stablecoins", "Full Tempo stablecoin matrix", {}, async () => {
    const result = await getStablecoins();
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
});
server.tool("get_stablecoin_flows", "Net directional flows between Tempo stablecoins", {
    hours: z
        .number()
        .optional()
        .default(24)
        .describe("Lookback window in hours (default 24, max 168)"),
}, async ({ hours }) => {
    const result = await getStablecoinFlows(hours ?? 24);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
});
// ── Start ──────────────────────────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
