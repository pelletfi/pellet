import { NextResponse } from "next/server";
import { getAllStablecoins } from "@/lib/pipeline/stablecoins";

export async function GET() {
  try {
    const stablecoins = await getAllStablecoins();
    return NextResponse.json({ stablecoins });
  } catch (err) {
    console.error("[GET /api/v1/stablecoins]", err);
    return NextResponse.json(
      { error: { code: "ENRICHMENT_FAILED", message: "Failed to fetch stablecoin data" } },
      { status: 502 }
    );
  }
}
