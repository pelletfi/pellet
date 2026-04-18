/**
 * GET /api/mpp/stablecoins/[address]/rewards
 *
 * $0.100 MPP first-mover — TIP-20 reward precompile attribution (opted-in
 * supply, global reward-per-token, funder attribution, effective APY).
 * Pellet is the first and only service on Tempo indexing the TIP-20 reward
 * precompile; this is a yield-allocation input with no peer. Priced at the
 * first-mover tier per the v2 pricing schedule.
 */

import { firstMoverCharge } from "@/lib/mpp/server";
import { GET as freeGET } from "../../../../v1/stablecoins/[address]/rewards/route";

export const dynamic = "force-dynamic";

export const GET = firstMoverCharge(freeGET);
