import { NextResponse } from "next/server";
import { deliverPending } from "@/lib/ingest/webhook-deliver";
import { runCron } from "@/lib/ingest/cron-wrapper";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const wrapped = await runCron("webhook-deliver", () => deliverPending());
  if (wrapped.ok) {
    return NextResponse.json({ ok: true, ...(wrapped.result as unknown as Record<string, unknown>) });
  }
  return NextResponse.json({ ok: false, error: wrapped.error }, { status: 500 });
}
