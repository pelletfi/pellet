import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { insertChatMessage } from "@/lib/db/wallet-chat";
import { type McpAuthInfo, requireScope } from "@/lib/mcp/auth";
import { executePayment } from "@/lib/wallet/execute-payment";
import { tempoChainConfig } from "@/lib/wallet/tempo-config";
import { parseUnits } from "viem";

const TOKEN_SYMBOLS = ["USDC.e", "USDT0", "pathUSD"] as const;
type TokenSymbol = (typeof TOKEN_SYMBOLS)[number];

const TOKEN_DECIMALS = 6;

function resolveTokenAddress(symbol: TokenSymbol): `0x${string}` | null {
  const chain = tempoChainConfig();
  switch (symbol) {
    case "USDC.e":
      return chain.usdcE;
    case "pathUSD":
      return chain.demoStable;
    case "USDT0":
      return chain.usdt0 ?? null;
  }
}

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
          .describe("Token symbol."),
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
        "Spend within an authorized Access Key cap (no per-transaction approval needed). Signs and broadcasts a transferWithMemo on-chain via the agent's Access Key. The wallet enforces caps both server-side and on-chain via AccountKeychain.",
      inputSchema: {
        recipient: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
        amount: z
          .string()
          .regex(/^\d+(\.\d+)?$/)
          .describe("Amount as a decimal string, e.g. '1.50'. Converted to wei (6 decimals)."),
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
      if (!auth.user.publicKeyUncompressed) {
        return {
          isError: true,
          content: [{ type: "text", text: "wallet user missing on-chain identity" }],
        };
      }

      const tokenAddress = resolveTokenAddress(token);
      if (!tokenAddress) {
        return {
          isError: true,
          content: [{ type: "text", text: `token ${token} not configured on this chain` }],
        };
      }

      const amountWei = parseUnits(amount, TOKEN_DECIMALS);
      if (amountWei <= BigInt(0)) {
        return {
          isError: true,
          content: [{ type: "text", text: "amount must be positive" }],
        };
      }

      const result = await executePayment({
        session: auth.session,
        user: {
          id: auth.user.id,
          managedAddress: auth.user.managedAddress,
          publicKeyUncompressed: auth.user.publicKeyUncompressed,
        },
        to: recipient as `0x${string}`,
        amountWei,
        memo,
        token: tokenAddress,
      });

      if (!result.ok) {
        try {
          await insertChatMessage({
            userId: auth.user.id,
            connectionId: auth.connection?.id ?? null,
            clientId: auth.token.clientId,
            sessionId: auth.session.id,
            sender: "agent",
            kind: "status",
            content: `Payment failed: ${amount} ${token} → ${recipient} — ${result.error}`,
            metadata: { recipient, amount, token, memo, error: result.error },
          });
        } catch {}
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `${result.error}${result.detail ? `: ${result.detail}` : ""}`,
            },
          ],
        };
      }

      try {
        await insertChatMessage({
          userId: auth.user.id,
          connectionId: auth.connection?.id ?? null,
          clientId: auth.token.clientId,
          sessionId: auth.session.id,
          sender: "agent",
          kind: "status",
          content: `Paid ${amount} ${token} → ${recipient}\n${memo}\n${result.explorerUrl}`,
          metadata: {
            recipient,
            amount,
            token,
            memo,
            txHash: result.txHash,
            explorerUrl: result.explorerUrl,
          },
        });
      } catch {}

      return {
        content: [
          {
            type: "text",
            text: `Sent ${amount} ${token} → ${recipient}. Tx: ${result.explorerUrl}`,
          },
        ],
        structuredContent: {
          txHash: result.txHash,
          explorerUrl: result.explorerUrl,
          from: result.from,
          to: result.to,
          amountWei: result.amountWei,
          feeWei: result.feeWei,
          feeTxHash: result.feeTxHash,
          remainingWei: result.remainingWei,
          periodEnd: result.periodEnd,
          spendCapWei: result.spendCapWei,
        },
      };
    },
  );
}
