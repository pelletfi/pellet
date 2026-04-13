import { NextRequest, NextResponse } from "next/server";
import { getAllStablecoins } from "@/lib/pipeline/stablecoins";

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;

  if (!ADDRESS_RE.test(address)) {
    return NextResponse.json(
      { error: { code: "INVALID_ADDRESS", message: "Address must be a 42-character 0x hex string" } },
      { status: 400 }
    );
  }

  try {
    const stablecoins = await getAllStablecoins();
    const match = stablecoins.find(
      (s) => s.address.toLowerCase() === address.toLowerCase()
    );

    if (!match) {
      return NextResponse.json(
        { error: { code: "TOKEN_NOT_FOUND", message: "No stablecoin found for this address" } },
        { status: 404 }
      );
    }

    return NextResponse.json(match);
  } catch (err) {
    console.error(`[GET /api/v1/stablecoins/${address}]`, err);
    return NextResponse.json(
      { error: { code: "ENRICHMENT_FAILED", message: "Failed to fetch stablecoin data" } },
      { status: 502 }
    );
  }
}
