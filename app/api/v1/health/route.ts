import { NextResponse } from "next/server";
import { tempoClient } from "@/lib/rpc";

export async function GET() {
  try {
    const block = await tempoClient.getBlockNumber();

    return NextResponse.json({
      status: "ok",
      chain: "tempo",
      block: Number(block),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[GET /api/v1/health]", err);
    return NextResponse.json(
      {
        status: "error",
        chain: "tempo",
        block: null,
        timestamp: new Date().toISOString(),
        message: err instanceof Error ? err.message : "RPC unavailable",
      },
      { status: 503 }
    );
  }
}
