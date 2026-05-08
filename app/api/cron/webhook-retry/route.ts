import { NextResponse } from "next/server";
import { runCron } from "@/lib/ingest/cron-wrapper";
import { processRetryQueue } from "@/lib/wallet/webhooks/dispatcher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// 1-min cadence (see vercel.json crons). Pulls up to 100 'retry' rows whose
// next_retry_at <= now() and re-attempts each. Successes / final failures
// transition out of 'retry' state inside attemptDelivery; rows that still
// need more retries get a fresh next_retry_at scheduled and stay in 'retry'.

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const wrapped = await runCron("webhook-retry", () => processRetryQueue());
  if (wrapped.ok) {
    return NextResponse.json({ ok: true, ...(wrapped.result as object) });
  }
  return NextResponse.json({ ok: false, error: wrapped.error }, { status: 500 });
}
