import { NextResponse } from "next/server";
import { processEvents } from "@/lib/ingest/event-processor";
import { runCron } from "@/lib/ingest/cron-wrapper";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const wrapped = await runCron("ingest", () => processEvents());
  if (wrapped.ok) {
    return NextResponse.json({ ok: true, ...(wrapped.result as object) });
  }
  return NextResponse.json({ ok: false, error: wrapped.error }, { status: 500 });
}
