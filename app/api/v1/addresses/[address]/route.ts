/**
 * GET /api/v1/addresses/{address}
 *
 * Wallet intelligence for any Tempo address. Combines:
 *   - curated + forensic labels (from address_labels)
 *   - ERC-8004 agent status (is this address an ERC-8004 agent?)
 *   - role holdings across tracked TIP-20 stablecoins (issuer, minter, pauser, burn-blocked)
 *   - derived "is_issuer_of", "is_minter_of", etc. summaries
 *
 * OLI discipline: every field has explicit coverage. Null means unmeasured,
 * never inferred as absent. See lib/pipeline/wallet-intelligence.ts for the
 * full list of deferred data sources + follow-up scopes.
 */

import { NextResponse } from "next/server";
import { getWalletIntelligence } from "@/lib/pipeline/wallet-intelligence";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;
  try {
    const intel = await getWalletIntelligence(address);
    return NextResponse.json(intel);
  } catch (err) {
    console.error("[GET /api/v1/addresses/:addr]", err);
    return NextResponse.json(
      {
        error: {
          code: "WALLET_INTEL_FAILED",
          message:
            "Wallet intelligence pipeline failed. Transient upstream issue most likely — retry shortly.",
        },
      },
      { status: 502 }
    );
  }
}
