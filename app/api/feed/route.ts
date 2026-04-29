import { recentFeed } from "@/lib/db/agent-events";
import { bus, type FeedRow } from "@/lib/realtime/bus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type FeedPayload = {
  id: string;
  agentId: string;
  agentLabel: string;
  ts: string;
  kind: string;
  summary: string;
  txSig: string;
  sourceBlock: number;
  methodologyVersion: string;
  isPellet: boolean;
};

function toPayload(r: FeedRow): FeedPayload {
  return {
    id: String(r.id),
    agentId: r.agentId,
    agentLabel: r.agentLabel,
    ts: r.ts.toISOString(),
    kind: r.kind,
    summary: r.summary,
    txSig: r.txHash,
    sourceBlock: r.sourceBlock,
    methodologyVersion: r.methodologyVersion,
    isPellet: r.isPellet,
  };
}

export async function GET() {
  await bus().start();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: FeedPayload) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch {
          // controller closed mid-write
        }
      };

      // Initial paint: last 100 events (oldest first so the client appends in order).
      const recent = await recentFeed(100);
      for (const r of recent.reverse()) send(toPayload(r));

      const onEvent = (row: FeedRow) => send(toPayload(row));
      bus().on("event", onEvent);

      // Heartbeat every 25s to keep the connection alive through proxies.
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
