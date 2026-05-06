import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerBalanceTool } from "./tools/balance";
import { registerThreadTools } from "./tools/thread";
import { registerSpendTools } from "./tools/spend";
import { registerMppRequestTool } from "./tools/mpp-request";
import type { McpAuthInfo } from "./auth";

// Build a per-request McpServer with auth bound via closure. We don't
// share McpServer instances across requests because the auth context
// (the Bearer token's resolved user/session) is per-request and tools
// need to read it inside their handlers.
//
// Tools registered:
//   * wallet.balance.get             (scope: wallet:read)
//   * wallet.thread.post             (scope: wallet:chat)
//   * wallet.thread.list             (scope: wallet:chat)
//   * wallet.spend.request_approval  (scope: wallet:spend:request)
//   * wallet.spend.execute           (scope: wallet:spend:authorized) — v1 stub
//
// Add new tools here by importing their register* function and calling it
// with (server, () => auth).

export function buildPelletMcpServer(auth: McpAuthInfo): McpServer {
  const server = new McpServer(
    {
      name: "pellet-wallet",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
        logging: {},
      },
    },
  );

  // Closure that returns the current request's auth — passed to each tool
  // module so handlers can read it without a global.
  const getAuth = () => auth;

  registerBalanceTool(server, getAuth);
  registerThreadTools(server, getAuth);
  registerSpendTools(server, getAuth);
  registerMppRequestTool(server, getAuth);

  return server;
}
