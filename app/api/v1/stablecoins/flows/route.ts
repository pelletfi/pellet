import { NextRequest, NextResponse } from "next/server";
import { getStablecoinFlows } from "@/lib/pipeline/stablecoins";

const MAX_HOURS = 168; // 7 days
const DEFAULT_HOURS = 24;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const rawHours = searchParams.get("hours");
  const hours = rawHours
    ? Math.min(MAX_HOURS, Math.max(1, parseInt(rawHours, 10) || DEFAULT_HOURS))
    : DEFAULT_HOURS;

  try {
    const flows = await getStablecoinFlows(hours);
    return NextResponse.json({ flows, hours });
  } catch (err) {
    console.error("[GET /api/v1/stablecoins/flows]", err);
    return NextResponse.json(
      { error: { code: "ENRICHMENT_FAILED", message: "Failed to fetch stablecoin flow data" } },
      { status: 502 }
    );
  }
}
