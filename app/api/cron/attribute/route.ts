import { NextResponse } from "next/server";
import { runAttribution } from "@/lib/ingest/gateway-attribution";
import { runCron } from "@/lib/ingest/cron-wrapper";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const wrapped = await runCron("attribute", () => runAttribution());
  if (wrapped.ok) {
    return NextResponse.json({ ok: true, ...(wrapped.result as object) });
  }
  return NextResponse.json({ ok: false, error: wrapped.error }, { status: 500 });
}
