import { NextResponse } from "next/server";
import { loadStatusStrip } from "@/lib/db/wallet-status-strip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/wallet/status-strip
//
// Public, no auth — chain-wide stats. The bottom-of-page status strip on
// every wallet/Wallet surface polls this every 30s. Live last-event updates
// also come through the existing /api/feed SSE stream so this endpoint
// only handles the periodic refresh of stats + sparkline.

export async function GET() {
  const data = await loadStatusStrip();
  return NextResponse.json(data, {
    headers: {
      // Short cache so multiple page-loads in the same minute share a
      // single round-trip — the strip is ambient, not high-frequency.
      "cache-control": "public, max-age=15, stale-while-revalidate=30",
    },
  });
}
