import { NextResponse } from "next/server";
import { bus, type WalletChatRow } from "@/lib/realtime/bus";
import { readUserSession } from "@/lib/wallet/challenge-cookie";
import { recentChatMessages } from "@/lib/db/wallet-chat";

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
    sessionId: r.sessionId,
    sender: r.sender,
    kind: r.kind,
    content: r.content,
    intentId: r.intentId,
    metadata: r.metadata,
    ts: r.createdAt.toISOString(),
  };
}

export async function GET() {
  const userId = await readUserSession();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  await bus().start();
  const encoder = new TextEncoder();

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
      const recent = await recentChatMessages(userId, 50);
      for (const r of recent.reverse()) send(toPayload(r));

      const onMessage = (row: WalletChatRow) => {
        if (row.userId !== userId) return;
        send(toPayload(row));
      };
      bus().on("chat-message", onMessage);

      // Typing pings — named SSE event 'typing' so the client can wire
      // a separate handler. Payload is { sessionId, ts } so the UI can
      // attribute which agent is composing.
      const onTyping = (t: { userId: string; sessionId: string; ts: string }) => {
        if (t.userId !== userId) return;
        try {
          controller.enqueue(
            encoder.encode(
              `event: typing\ndata: ${JSON.stringify({ sessionId: t.sessionId, ts: t.ts })}\n\n`,
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

      const cleanup = () => {
        clearInterval(heartbeat);
        bus().off("chat-message", onMessage);
        bus().off("chat-typing", onTyping);
        try {
          controller.close();
        } catch {
          /* noop */
        }
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (controller as any).signal?.addEventListener?.("abort", cleanup);
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
