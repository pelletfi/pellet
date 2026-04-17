import { NextResponse } from "next/server";
import { refreshHolderSnapshots } from "@/lib/ingest/holder-snapshot-builder";
import { runCron } from "@/lib/ingest/cron-wrapper";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const wrapped = await runCron("holder-snapshot", () => refreshHolderSnapshots());
  if (wrapped.ok) {
    return NextResponse.json({ ok: true, ...(wrapped.result as unknown as Record<string, unknown>) });
  }
  return NextResponse.json({ ok: false, error: wrapped.error }, { status: 500 });
}
