import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { insertChatMessage } from "@/lib/db/wallet-chat";
import { type McpAuthInfo, requireScope } from "@/lib/mcp/auth";

// Spend tools — v1 stubs that post structured chat messages instead of
// executing on-chain transactions. The actual chain calls land when the
// wallet pivot to Tempo Access Keys ships (the wallet.pay route gets
// rewired to call AccountKeychain.transferWithMemo from the access key).
//
// For now:
//   * spend.request_approval  — posts an approval_request chat message
//                                with the spend intent in metadata; the
//                                user-side approve UI (next iteration)
//                                triggers the actual chain call.
//   * spend.execute           — currently posts a status update saying
//                                "would have spent $X" with the intent.
//                                Returns success so MCP-side flows can
//                                exercise the wiring while the chain
//                                integration is still being built.

const TOKEN_SYMBOLS = ["USDC.e", "USDT0", "pathUSD"] as const;

export function registerSpendTools(
  server: McpServer,
  getAuth: () => McpAuthInfo | null,
): void {
  server.registerTool(
    "wallet.spend.request_approval",
    {
      title: "Request user approval for a spend",
      description:
        "Request the user's explicit approval for a one-off transaction. Posts an approval_request message to the wallet chat thread with the recipient, amount, and memo. The user reviews and approves in the wallet UI (or via a future approval flow). Use for any spend that's not pre-authorized via an Access Key cap.",
      inputSchema: {
        recipient: z
          .string()
          .regex(/^0x[0-9a-fA-F]{40}$/)
          .describe("Recipient EVM address (0x + 40 hex chars)."),
        amount: z
          .string()
          .regex(/^\d+(\.\d+)?$/)
          .describe("Amount as a decimal string, e.g. '1.50'."),
        token: z
          .enum(TOKEN_SYMBOLS)
          .describe("Token symbol — USDC.e or USDT0 on mainnet, pathUSD on testnet."),
        memo: z
          .string()
          .max(200)
          .describe("Short human-readable reason for the spend (shown to the user)."),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ recipient, amount, token, memo }) => {
      const auth = getAuth();
      if (!auth) {
        return {
          isError: true,
          content: [{ type: "text", text: "no authenticated session" }],
        };
      }
      requireScope(auth, "wallet:spend:request");

      const row = await insertChatMessage({
        userId: auth.user.id,
        connectionId: auth.connection?.id ?? null,
        clientId: auth.token.clientId,
        sessionId: auth.session?.id ?? null,
        sender: "agent",
        kind: "approval_request",
        content: `Spend ${amount} ${token} → ${recipient}\n${memo}`,
        metadata: { recipient, amount, token, memo },
      });

      return {
        content: [
          {
            type: "text",
            text: `Approval requested: ${row.id}. The user will review in their wallet.`,
          },
        ],
        structuredContent: {
          id: row.id,
          status: "pending_approval",
          ts: row.createdAt.toISOString(),
        },
      };
    },
  );

  server.registerTool(
    "wallet.spend.execute",
    {
      title: "Spend within authorized cap",
      description:
        "Spend within an authorized Access Key cap (no per-transaction approval needed). The wallet enforces the cap on-chain. v1: this is a stub — it posts a status message but does not yet execute the on-chain transfer. The chain integration ships with the Tempo Access Keys wallet pivot.",
      inputSchema: {
        recipient: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
        amount: z.string().regex(/^\d+(\.\d+)?$/),
        token: z.enum(TOKEN_SYMBOLS),
        memo: z.string().max(200),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ recipient, amount, token, memo }) => {
      const auth = getAuth();
      if (!auth) {
        return {
          isError: true,
          content: [{ type: "text", text: "no authenticated session" }],
        };
      }
      requireScope(auth, "wallet:spend:authorized");
      if (!auth.session) {
        return {
          isError: true,
          content: [
            { type: "text", text: "no Access Key session linked to this token" },
          ],
        };
      }

      // v1 stub: post a status message announcing the intended spend. Real
      // on-chain execution wires up with the Tempo Access Keys pivot.
      const row = await insertChatMessage({
        userId: auth.user.id,
        connectionId: auth.connection?.id ?? null,
        clientId: auth.token.clientId,
        sessionId: auth.session.id,
        sender: "agent",
        kind: "status",
        content: `[stub] would spend ${amount} ${token} → ${recipient}\n${memo}`,
        metadata: { recipient, amount, token, memo, stub: true },
      });

      return {
        content: [
          {
            type: "text",
            text: `Spend recorded (stub): ${row.id}. On-chain execution pending Tempo Access Keys integration.`,
          },
        ],
        structuredContent: {
          id: row.id,
          status: "stub",
          ts: row.createdAt.toISOString(),
        },
      };
    },
  );
}
