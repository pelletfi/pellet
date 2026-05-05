import { NextResponse } from "next/server";
import { bus, type WalletChatRow, type WalletChatChunk } from "@/lib/realtime/bus";
import { readUserSession } from "@/lib/wallet/challenge-cookie";
import { recentChatMessages } from "@/lib/db/wallet-chat";
import { getConnectedAgent } from "@/lib/db/wallet-agent-connections";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/wallet/chat/stream
//
// Cookie-auth'd (the wallet UI is logged in via passkey). Server-Sent Events
// stream of chat messages for the current user. Backed by the realtime bus
// (lib/realtime/bus.ts) which LISTENs on:
//   * 'wallet_chat'        — message inserts (default SSE event)
//   * 'wallet_chat_typing' — ephemeral typing pings (named SSE event 'typing')
//
// On connect: paints the last 50 messages oldest-first so the client appends
// in chronological order. After that, every new event for this user pushes
// live.
//
// Heartbeat every 25s keeps the connection alive through Vercel/proxy idle
// timeouts. Clients should reconnect on close.

type SSEPayload = {
  id: string;
  connectionId: string | null;
  clientId: string | null;
  sessionId: string | null;
  sender: WalletChatRow["sender"];
  kind: WalletChatRow["kind"];
  content: string;
  intentId: string | null;
  metadata: unknown;
  ts: string;
};

function toPayload(r: WalletChatRow): SSEPayload {
  return {
    id: r.id,
    connectionId: r.connectionId,
    clientId: r.clientId,
    sessionId: r.sessionId,
    sender: r.sender,
    kind: r.kind,
    content: r.content,
    intentId: r.intentId,
    metadata: r.metadata,
    ts: r.createdAt.toISOString(),
  };
}

export async function GET(req: Request) {
  const userId = await readUserSession();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const requestedConnectionId = searchParams.get("agent") ?? searchParams.get("connectionId");
  const connection = requestedConnectionId
    ? await getConnectedAgent({ userId, connectionId: requestedConnectionId })
    : null;
  if (requestedConnectionId && !connection) {
    return NextResponse.json(
      { error: "agent connection not found" },
      { status: 404 },
    );
  }

  await bus().start();
  const encoder = new TextEncoder();
  let cleanup: () => void = () => {};

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: SSEPayload) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch {
          // controller closed mid-write
        }
      };

      // Initial paint: last 50 messages, oldest first.
      const recent = await recentChatMessages(userId, 50, {
        connectionId: connection?.id ?? null,
      });
      for (const r of recent.reverse()) send(toPayload(r));

      const onMessage = (row: WalletChatRow) => {
        if (row.userId !== userId) return;
        if (connection && row.connectionId !== connection.id) return;
        send(toPayload(row));
      };
      bus().on("chat-message", onMessage);

      // Streaming chunks — named SSE event 'chunk'. Client accumulates
      // deltas by messageId and renders progressively.
      const onChunk = (c: WalletChatChunk) => {
        if (c.userId !== userId) return;
        if (connection && c.connectionId !== connection.id) return;
        try {
          controller.enqueue(
            encoder.encode(
              `event: chunk\ndata: ${JSON.stringify({
                messageId: c.messageId,
                delta: c.delta,
                done: c.done,
              })}\n\n`,
            ),
          );
        } catch {
          /* controller closed mid-write */
        }
      };
      bus().on("chat-chunk", onChunk);

      // Typing pings — named SSE event 'typing' so the client can wire
      // a separate handler. Payload is { sessionId, ts } so the UI can
      // attribute which agent is composing.
      const onTyping = (t: {
        userId: string;
        connectionId: string | null;
        sessionId: string;
        ts: string;
      }) => {
        if (t.userId !== userId) return;
        if (connection && t.connectionId !== connection.id) return;
        try {
          controller.enqueue(
            encoder.encode(
              `event: typing\ndata: ${JSON.stringify({
                connectionId: t.connectionId,
                sessionId: t.sessionId,
                ts: t.ts,
              })}\n\n`,
            ),
          );
        } catch {
          /* controller closed mid-write */
        }
      };
      bus().on("chat-typing", onTyping);

      // Heartbeat — keeps the connection alive through proxies that drop
      // idle TCP after ~30s.
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          clearInterval(heartbeat);
        }
      }, 25_000);

      cleanup = () => {
        clearInterval(heartbeat);
        bus().off("chat-message", onMessage);
        bus().off("chat-chunk", onChunk);
        bus().off("chat-typing", onTyping);
        req.signal.removeEventListener("abort", cleanup);
        try {
          controller.close();
        } catch {
          /* noop */
        }
      };
      req.signal.addEventListener("abort", cleanup, { once: true });
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    },
  });
}
