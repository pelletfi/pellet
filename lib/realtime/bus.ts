import { EventEmitter } from "node:events";
import { listenPool } from "@/lib/db/client";
import { getFeedRowById, type FeedRow } from "@/lib/db/agent-events";
import { dispatchToWebhooks } from "@/lib/oli/webhooks/dispatcher";
import { getChatMessageById, type WalletChatRow } from "@/lib/db/wallet-chat";

// Per-instance bus. Each Vercel function instance opens its own LISTEN
// connection on first SSE request — postgres broadcasts NOTIFY to all
// listeners so every instance gets every event regardless of which one is
// hosting the SSE client.
//
// Two channels: 'agent_events' for the public feed (existing) and
// 'wallet_chat' for in-wallet messages (chat substrate v1).
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
          if (row) this.emit("chat-message", row);
        } catch {
          // swallow
        }
        return;
      }
    });
    await client.query("LISTEN agent_events");
    await client.query("LISTEN wallet_chat");
    // Connection is held for the process lifetime. No need to release.
  }
}

const _bus = new Bus();
export function bus(): Bus {
  return _bus;
}

export type { FeedRow, WalletChatRow };
