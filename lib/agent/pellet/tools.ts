import { tool } from "ai";
import { z } from "zod";
import type { Address } from "viem";
import { readWalletBalances } from "@/lib/wallet/tempo-balance";
import { MPP_SERVICES } from "@/lib/mpp/registry";
import { recentChatMessages } from "@/lib/db/wallet-chat";

export type ToolContext = {
  userId: string;
  managedAddress: Address;
};

export function buildTools(ctx: ToolContext) {
  return {
    getBalance: tool({
      description: "Get the user's current Tempo wallet balances across supported tokens.",
      inputSchema: z.object({}),
      execute: async () => {
        const balances = await readWalletBalances(ctx.managedAddress);
        return {
          balances: balances.map((b) => ({
            symbol: b.symbol,
            address: b.address,
            display: b.display,
          })),
        };
      },
    }),

    listMppServices: tool({
      description:
        "List MPP / x402 services from the catalog. Use this when the user asks what services are available or wants to find a service for a capability.",
      inputSchema: z.object({
        category: z
          .string()
          .optional()
          .describe("Optional category filter (e.g. 'ai', 'search')"),
      }),
      execute: async ({ category }) => {
        const filtered = category
          ? MPP_SERVICES.filter((s) => s.category === category)
          : MPP_SERVICES;
        return {
          services: filtered.map((s) => ({
            id: s.id,
            name: s.name,
            category: s.category,
            url: s.url,
          })),
        };
      },
    }),

    getThread: tool({
      description:
        "Read the user's recent chat history with Pellet Agent. Use only when the user explicitly references prior context.",
      inputSchema: z.object({
        lastN: z.number().int().min(1).max(50).default(10),
      }),
      execute: async ({ lastN }) => {
        const rows = await recentChatMessages(ctx.userId, lastN);
        return {
          messages: rows.map((r) => ({
            sender: r.sender,
            content: r.content,
            createdAt: r.createdAt.toISOString(),
          })),
        };
      },
    }),

    proposeSend: tool({
      description:
        "Propose a send. Returns a confirmation payload — DOES NOT EXECUTE. The CLI renders (y/n); on yes, the deterministic /api/wallet/pay path runs.",
      inputSchema: z.object({
        to: z.string().describe("Recipient address (0x...) or registered handle"),
        amount: z.string().describe("Amount as a decimal string, e.g. '1.5'"),
        asset: z.enum(["USDC.e", "pathUSD"]).describe("Asset symbol"),
      }),
      execute: async ({ to, amount, asset }) => ({
        kind: "confirmation_required" as const,
        action: "send" as const,
        params: { to, amount, asset },
        message: `Send ${amount} ${asset} to ${to}? (y/n)`,
      }),
    }),

    proposeSwap: tool({
      description: "Propose a swap. Returns a confirmation payload — DOES NOT EXECUTE.",
      inputSchema: z.object({
        from: z.enum(["USDC.e", "pathUSD"]),
        to: z.enum(["USDC.e", "pathUSD"]),
        amount: z.string(),
      }),
      execute: async ({ from, to, amount }) => ({
        kind: "confirmation_required" as const,
        action: "swap" as const,
        params: { from, to, amount },
        message: `Swap ${amount} ${from} → ${to}? (y/n)`,
      }),
    }),

    callMppService: tool({
      description:
        "Propose a call to an MPP / x402 service. Always returns a confirmation_required envelope (or error if the service id is unknown). The CLI renders the proposal and the user approves before the deterministic /api/v1/mpp/call path runs.",
      inputSchema: z.object({
        serviceId: z.string().describe("Catalog id from listMppServices, e.g. 'openai'"),
        path: z.string().describe("Endpoint path on that service, e.g. '/v1/chat/completions'"),
        method: z.enum(["GET", "POST"]).default("POST"),
        body: z.unknown().nullable().describe("Request body (or null for GET)"),
      }),
      execute: async ({ serviceId, path, method, body }) => {
        const svc = MPP_SERVICES.find((s) => s.id === serviceId);
        if (!svc) {
          return { kind: "error" as const, message: `Unknown service id: ${serviceId}` };
        }
        return {
          kind: "confirmation_required" as const,
          action: "mpp_call" as const,
          params: { serviceId, serviceUrl: svc.url, path, method, body },
          message: `Call ${svc.name} ${method} ${path}? (y/n)`,
        };
      },
    }),
  };
}
