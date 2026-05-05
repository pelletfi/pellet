import { EventEmitter } from "node:events";
import { listenPool } from "@/lib/db/client";
import { getFeedRowById, type FeedRow } from "@/lib/db/agent-events";
import { dispatchToWebhooks } from "@/lib/oli/webhooks/dispatcher";
import { getChatMessageById, type WalletChatRow } from "@/lib/db/wallet-chat";
import { dispatchUserChatToWebhooks } from "@/lib/wallet/chat-webhook-dispatcher";

// Per-instance bus. Each Vercel function instance opens its own LISTEN
// connection on first SSE request — postgres broadcasts NOTIFY to all
// listeners so every instance gets every event regardless of which one is
// hosting the SSE client.
//
// Three channels:
//   * 'agent_events'       — public OLI feed (table-trigger backed)
//   * 'wallet_chat'        — in-wallet messages (table-trigger backed)
//   * 'wallet_chat_typing' — ephemeral typing pings (no row; fired directly
//                            by chat routes/tools). Payload format is
//                            "userId:connectionId:sessionId" so SSE handlers
//                            can filter by user + agent.

export type WalletChatTyping = {
  userId: string;
  connectionId: string | null;
  sessionId: string;
  ts: string;
};

export type WalletChatChunk = {
  messageId: string;
  userId: string;
  connectionId: string | null;
  delta: string;
  done: boolean;
};

class Bus extends EventEmitter {
  private started = false;

  async start() {
    if (this.started) return;
    this.started = true;

    const pool = listenPool();
    const client = await pool.connect();
    client.on("notification", async (msg) => {
      if (!msg.payload) return;
      if (msg.channel === "agent_events") {
        const eventId = Number(msg.payload);
        // Fan out to webhook subscribers in parallel with the SSE emit. Both
        // call sites use the (subscription_id, event_id) unique index for
        // idempotency, so duplicate dispatches (here + the inline match-runner
        // call) collapse to a single delivery row.
        void dispatchToWebhooks(eventId).catch(() => {});
        try {
          const row = await getFeedRowById(eventId);
          if (row) this.emit("event", row);
        } catch {
          // swallow — failure to fetch a row shouldn't break the bus
        }
        return;
      }
      if (msg.channel === "wallet_chat") {
        try {
          const row = await getChatMessageById(msg.payload);
          if (row) {
            this.emit("chat-message", row);
            // Fan user-side messages out to OAuth-client webhooks. Internal
            // filter (sender='user' only) lives in the dispatcher; we call
            // it for every row so the routing rules stay in one place.
            void dispatchUserChatToWebhooks(row).catch((err) => {
              console.warn("[bus] chat-webhook dispatch failed:", err);
            });
          }
        } catch {
          // swallow
        }
        return;
      }
      if (msg.channel === "wallet_chat_chunk") {
        try {
          const chunk = JSON.parse(msg.payload) as WalletChatChunk;
          this.emit("chat-chunk", chunk);
        } catch {
          // malformed payload
        }
        return;
      }
      if (msg.channel === "wallet_chat_typing") {
        const [userId, second, third] = msg.payload.split(":");
        if (!userId) return;
        const connectionId = third === undefined ? null : second || null;
        const sessionId = third === undefined ? second : third || "";
        if (!connectionId && !sessionId) return;
        this.emit("chat-typing", {
          userId,
          connectionId,
          sessionId,
          ts: new Date().toISOString(),
        } as WalletChatTyping);
        return;
      }
    });
    await client.query("LISTEN agent_events");
    await client.query("LISTEN wallet_chat");
    await client.query("LISTEN wallet_chat_chunk");
    await client.query("LISTEN wallet_chat_typing");
    // Connection is held for the process lifetime. No need to release.
  }
}

const _bus = new Bus();
export function bus(): Bus {
  return _bus;
}

export type { FeedRow, WalletChatRow };
