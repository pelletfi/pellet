import { z } from "zod";
import { sql } from "drizzle-orm";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db } from "@/lib/db/client";
import {
  insertChatMessage,
  recentChatMessages,
  type WalletChatRow,
} from "@/lib/db/wallet-chat";
import { type McpAuthInfo, requireScope } from "@/lib/mcp/auth";

// Three thread tools:
//   * wallet.thread.post           — agent posts a status / question / report
//   * wallet.thread.list           — agent reads recent thread history
//   * wallet.thread.signal_typing  — agent signals "I'm composing", wallet
//                                    UI shows pulsing dots until next message
//                                    or 8s timeout
//
// All require wallet:chat scope. Posts are tagged with the durable OAuth
// client connection so the wallet UI can keep one lane per BYOA agent.

const KIND_VALUES = ["status", "question", "approval_request", "reply", "report"] as const;
type Kind = (typeof KIND_VALUES)[number];

export function registerThreadTools(
  server: McpServer,
  getAuth: () => McpAuthInfo | null,
): void {
  server.registerTool(
    "wallet.thread.post",
    {
      title: "Post a chat message",
      description:
        "Post a message into the user's wallet chat thread. Use kind='status' for routine updates, 'question' to ask the user something, 'report' for end-of-task summaries. For spend approval, use wallet.spend.request_approval instead — it includes the proper structured payload.",
      inputSchema: {
        content: z
          .string()
          .min(1)
          .max(8000)
          .describe("The message body (max 8000 chars)."),
        kind: z
          .enum(KIND_VALUES)
          .default("status")
          .describe(
            "Message kind. 'status' for routine updates, 'question' for asks, 'report' for summaries, 'reply' for follow-ups.",
          ),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ content, kind }) => {
      const auth = getAuth();
      if (!auth) {
        return {
          isError: true,
          content: [{ type: "text", text: "no authenticated session" }],
        };
      }
      requireScope(auth, "wallet:chat");

      const row = await insertChatMessage({
        userId: auth.user.id,
        connectionId: auth.connection?.id ?? null,
        clientId: auth.token.clientId,
        sessionId: auth.session?.id ?? null,
        sender: "agent",
        kind: kind as Kind,
        content,
      });

      return {
        content: [{ type: "text", text: `Posted: ${row.id}` }],
        structuredContent: {
          id: row.id,
          ts: row.createdAt.toISOString(),
        },
      };
    },
  );

  server.registerTool(
    "wallet.thread.list",
    {
      title: "List recent chat messages",
      description:
        "Read the user's wallet chat thread (newest first). Returns sender, kind, content, and timestamp for each message.",
      inputSchema: {
        limit: z
          .number()
          .int()
          .min(1)
          .max(200)
          .default(50)
          .describe("Number of messages to return (max 200)."),
      },
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async ({ limit }) => {
      const auth = getAuth();
      if (!auth) {
        return {
          isError: true,
          content: [{ type: "text", text: "no authenticated session" }],
        };
      }
      requireScope(auth, "wallet:chat");

      const rows = await recentChatMessages(auth.user.id, limit, {
        connectionId: auth.connection?.id ?? null,
      });
      const summary = rows
        .map(
          (r) =>
            `[${r.createdAt.toISOString()}] ${r.sender}/${r.kind}: ${r.content}`,
        )
        .join("\n");

      return {
        content: [
          {
            type: "text",
            text: rows.length === 0 ? "no messages" : summary,
          },
        ],
        structuredContent: {
          messages: rows.map(toWire),
        },
      };
    },
  );

  server.registerTool(
    "wallet.thread.signal_typing",
    {
      title: "Signal that you're composing a response",
      description:
        "Tell the wallet UI you're in the middle of composing a response. Shows a pulsing-dots indicator until your next wallet.thread.post call OR an 8-second timeout. Call this whenever you're about to think for more than ~2 seconds before posting — it makes the wallet feel alive instead of frozen. No-op if no Access Key session is linked to this token.",
      inputSchema: {},
      annotations: { readOnlyHint: false, idempotentHint: true },
    },
    async () => {
      const auth = getAuth();
      if (!auth) {
        return {
          isError: true,
          content: [{ type: "text", text: "no authenticated session" }],
        };
      }
      requireScope(auth, "wallet:chat");
      if (!auth.connection && !auth.session) {
        return {
          isError: true,
          content: [{ type: "text", text: "no agent connection linked to this token" }],
        };
      }
      const payload = [
        auth.user.id,
        auth.connection?.id ?? "",
        auth.session?.id ?? "",
      ].join(":");
      await db.execute(sql`SELECT pg_notify('wallet_chat_typing', ${payload})`);
      return {
        content: [{ type: "text", text: "typing signal sent" }],
      };
    },
  );
}

function toWire(r: WalletChatRow) {
  return {
    id: r.id,
    connectionId: r.connectionId,
    clientId: r.clientId,
    sessionId: r.sessionId,
    sender: r.sender,
    kind: r.kind,
    content: r.content,
    intentId: r.intentId,
    ts: r.createdAt.toISOString(),
  };
}
