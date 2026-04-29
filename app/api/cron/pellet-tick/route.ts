import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { agentEvents } from "@/lib/db/schema";
import { sql } from "drizzle-orm";
import { runCron } from "@/lib/ingest/cron-wrapper";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const METHODOLOGY_VERSION = "v0.1";

async function postObservation() {
  const agentResult = await db.execute<{ n: string }>(
    sql`SELECT COUNT(*)::text AS n FROM agents WHERE active = TRUE`,
  );
  const eventResult = await db.execute<{ n: string }>(
    sql`SELECT COUNT(*)::text AS n FROM agent_events WHERE ts > now() - interval '1 hour'`,
  );

  const agentN = (agentResult.rows[0] as { n: string }).n;
  const eventN = (eventResult.rows[0] as { n: string }).n;
  const summary = `noted: ${agentN} agents tracked · ${eventN} events in the last hour`;

  await db.insert(agentEvents).values({
    agentId: "pellet",
    txHash: `pellet-tick-${Date.now()}`,
    logIndex: 0,
    ts: new Date(),
    kind: "custom",
    summary,
    targets: {},
    sourceBlock: 0,
    methodologyVersion: METHODOLOGY_VERSION,
  });

  return { summary, agents: Number(agentN), eventsLastHour: Number(eventN) };
}

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const wrapped = await runCron("pellet-tick", postObservation);
  if (wrapped.ok) return NextResponse.json({ ok: true, ...(wrapped.result as object) });
  return NextResponse.json({ ok: false, error: wrapped.error }, { status: 500 });
}
