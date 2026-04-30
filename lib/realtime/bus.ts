import { EventEmitter } from "node:events";
import { listenPool } from "@/lib/db/client";
import { getFeedRowById, type FeedRow } from "@/lib/db/agent-events";
import { dispatchToWebhooks } from "@/lib/oli/webhooks/dispatcher";

// Per-instance bus. Each Vercel function instance opens its own LISTEN
// connection on first SSE request — postgres broadcasts NOTIFY to all
// listeners so every instance gets every event regardless of which one is
// hosting the SSE client.
class Bus extends EventEmitter {
  private started = false;

  async start() {
    if (this.started) return;
    this.started = true;

    const pool = listenPool();
    const client = await pool.connect();
    client.on("notification", async (msg) => {
      if (msg.channel !== "agent_events" || !msg.payload) return;
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
    });
    await client.query("LISTEN agent_events");
    // Connection is held for the process lifetime. No need to release.
  }
}

const _bus = new Bus();
export function bus(): Bus {
  return _bus;
}

export type { FeedRow };
