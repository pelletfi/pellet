import { bus } from "@/lib/realtime/bus";
import { db } from "@/lib/db/client";
import { sql } from "drizzle-orm";
import type { RecentEventRow } from "@/lib/oli/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Fetch a single agent_events row joined with agent label + counterparty label
// — same shape as recentDecoded() rows, since EventStream consumes RecentEventRow.
async function fetchOneAsRecent(id: number): Promise<RecentEventRow | null> {
  const rows = await db.execute<{
    id: number;
    ts: Date | string;
    agent_id: string;
    agent_label: string;
    agent_category: string | null;
    counterparty_address: string | null;
    counterparty_label: string | null;
    counterparty_category: string | null;
    kind: string;
    amount_wei: string | null;
    token_address: string | null;
    tx_hash: string;
    source_block: number;
    methodology_version: string;
    routed_to_address: string | null;
    routed_to_label: string | null;
    routed_fingerprint: string | null;
  }>(sql`
    SELECT
      ae.id::int                              AS id,
      ae.ts                                   AS ts,
      ae.agent_id                             AS agent_id,
      a.label                                 AS agent_label,
      (a.links ->> 'category')                AS agent_category,
      ae.counterparty_address                 AS counterparty_address,
      cl.label                                AS counterparty_label,
      cl.category                             AS counterparty_category,
      ae.kind                                 AS kind,
      ae.amount_wei                           AS amount_wei,
      ae.token_address                        AS token_address,
      ae.tx_hash                              AS tx_hash,
      ae.source_block::int                    AS source_block,
      ae.methodology_version                  AS methodology_version,
      ae.routed_to_address                    AS routed_to_address,
      rl.label                                AS routed_to_label,
      ae.routed_fingerprint                   AS routed_fingerprint
    FROM agent_events ae
    JOIN agents a ON a.id = ae.agent_id
    LEFT JOIN address_labels cl ON cl.address = LOWER(ae.counterparty_address)
    LEFT JOIN address_labels rl ON rl.address = LOWER(ae.routed_to_address)
    WHERE ae.id = ${id}
    LIMIT 1
  `);
  if (rows.rows.length === 0) return null;
  const r = rows.rows[0];
  return {
    id: r.id,
    ts: r.ts instanceof Date ? r.ts : new Date(r.ts as string),
    agentId: r.agent_id,
    agentLabel: r.agent_label,
    agentCategory: r.agent_category,
    counterpartyAddress: r.counterparty_address,
    counterpartyLabel: r.counterparty_label,
    counterpartyCategory: r.counterparty_category,
    kind: r.kind,
    amountWei: r.amount_wei,
    tokenAddress: r.token_address,
    txHash: r.tx_hash,
    sourceBlock: r.source_block,
    methodologyVersion: r.methodology_version,
    routedToAddress: r.routed_to_address,
    routedToLabel: r.routed_to_label,
    routedFingerprint: r.routed_fingerprint,
  };
}

type SsePayload = Omit<RecentEventRow, "ts"> & { ts: string };

function toPayload(r: RecentEventRow): SsePayload {
  return { ...r, ts: r.ts.toISOString() };
}

export async function GET() {
  await bus().start();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: SsePayload) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch {
          // controller closed mid-write
        }
      };

      // We send NO initial paint here — the OLI dashboard already SSR'd the
      // last 25 events. SSE only carries deltas after that. Simpler protocol;
      // client just merges incoming events with what's already in the DOM.

      // The realtime bus emits FeedRow shape. We re-fetch in OLI shape so that
      // EventStream receives the full RecentEventRow with counterparty labels.
      const onEvent = async (busRow: { id: number | string }) => {
        const id = typeof busRow.id === "string" ? Number(busRow.id) : busRow.id;
        if (!Number.isFinite(id)) return;
        const recent = await fetchOneAsRecent(id);
        if (recent) send(toPayload(recent));
      };
      bus().on("event", onEvent);

      // Heartbeat every 25s.
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          clearInterval(heartbeat);
        }
      }, 25_000);

      const cleanup = () => {
        clearInterval(heartbeat);
        bus().off("event", onEvent);
        try { controller.close(); } catch {}
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
      connection: "keep-alive",
    },
  });
}
