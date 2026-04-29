import { EventEmitter } from "node:events";
import { listenPool } from "@/lib/db/client";
import { getFeedRowById, type FeedRow } from "@/lib/db/agent-events";

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
      try {
        const row = await getFeedRowById(Number(msg.payload));
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
