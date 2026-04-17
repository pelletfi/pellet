/**
 * GET /api/v1/tip403/simulate
 *
 * Pre-trade compliance oracle. Given a proposed TIP-20 transfer
 * {from, to, token, amount?}, returns a structured prediction of whether
 * the transfer would succeed, citing the specific TIP-403 policy, the
 * authorization status of each party, and (if amount is provided) whether
 * sender balance is sufficient.
 *
 * Read-only. Issues no transactions. Intended for agents to call before
 * spending gas on a transfer that would revert.
 */

import { NextResponse } from "next/server";
import { simulateTransfer } from "@/lib/pipeline/tip403";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  const token = url.searchParams.get("token") ?? "";
  const amount = url.searchParams.get("amount") ?? undefined;

  if (!from || !to || !token) {
    return NextResponse.json(
      {
        error: {
          code: "MISSING_PARAM",
          message:
            "Required query params: from, to, token. Optional: amount (raw uint256 decimal string).",
        },
      },
      { status: 400 }
    );
  }

  try {
    const result = await simulateTransfer({ from, to, token, amount });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[GET /api/v1/tip403/simulate]", err);
    return NextResponse.json(
      {
        error: {
          code: "SIMULATE_FAILED",
          message:
            "Simulation failed. Transient RPC error most likely — retry in a moment.",
        },
      },
      { status: 502 }
    );
  }
}
