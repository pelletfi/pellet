import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { type McpAuthInfo, requireScope } from "@/lib/mcp/auth";
import { mppRequest } from "@/lib/mpp/request";
import { insertChatMessage } from "@/lib/db/wallet-chat";

export function registerMppRequestTool(
  server: McpServer,
  getAuth: () => McpAuthInfo | null,
): void {
  server.registerTool(
    "wallet.mpp.request",
    {
      title: "Make an MPP-enabled HTTP request",
      description:
        "Make an HTTP request to an MPP-enabled service. If the service returns 402 Payment Required, the wallet automatically pays from your session budget and retries. Returns the final response. Use this for any MPP service call — AI inference, search, data APIs, etc.",
      inputSchema: {
        url: z.string().url().describe("The full URL of the MPP service endpoint"),
        method: z
          .enum(["GET", "POST", "PUT", "PATCH", "DELETE"])
          .default("GET")
          .describe("HTTP method"),
        headers: z
          .record(z.string(), z.string())
          .optional()
          .describe("Additional request headers (e.g. Content-Type)"),
        body: z
          .string()
          .optional()
          .describe("Request body (for POST/PUT/PATCH)"),
      },
    },
    async ({ url, method, headers, body }) => {
      const auth = getAuth();
      if (!auth) {
        return {
          content: [{ type: "text" as const, text: "Not authenticated." }],
          isError: true,
        };
      }
      requireScope(auth, "wallet:spend:authorized");

      if (!auth.session) {
        return {
          content: [
            {
              type: "text" as const,
              text: "No Access Key session linked. Connect via the wallet onboard flow first.",
            },
          ],
          isError: true,
        };
      }

      if (!auth.user.publicKeyUncompressed) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Wallet has no public key configured. Complete wallet setup first.",
            },
          ],
          isError: true,
        };
      }

      const result = await mppRequest({
        url,
        method,
        headers: headers as Record<string, string> | undefined,
        body,
        session: auth.session,
        user: auth.user as { id: string; managedAddress: string; publicKeyUncompressed: string },
      });

      if (result.payment) {
        await insertChatMessage({
          userId: auth.user.id,
          connectionId: auth.connection?.id ?? null,
          clientId: auth.token.clientId,
          sessionId: auth.session.id,
          sender: "system",
          kind: "status",
          content: `MPP payment: ${result.payment.amountWei} wei → ${result.payment.recipient}`,
          metadata: {
            type: "mpp_payment",
            challengeId: result.payment.challengeId,
            txHash: result.payment.txHash,
            explorerUrl: result.payment.explorerUrl,
            serviceUrl: url,
            responseStatus: result.status,
          },
        });
      }

      const summary = result.payment
        ? `\n\n---\nMPP Payment: ${result.payment.txHash}\nExplorer: ${result.payment.explorerUrl}`
        : "";

      return {
        content: [
          {
            type: "text" as const,
            text: `HTTP ${result.status}${summary}\n\n${result.body}`,
          },
        ],
      };
    },
  );
}
