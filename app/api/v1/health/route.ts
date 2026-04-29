import { NextResponse } from "next/server";
import { tempoClient } from "@/lib/rpc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Used by the landing-page block-height ticker + the Nav status indicator.
export async function GET() {
  try {
    const block = Number(await tempoClient.getBlockNumber());
    return NextResponse.json({ status: "ok", block });
  } catch (e) {
    return NextResponse.json({
      status: "fail",
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
