/**
 * GET /api/mpp/stablecoins/[address]/risk
 *
 * Zero-charge MPP mirror of /api/v1/stablecoins/[address]/risk.
 */

import { identityCharge } from "@/lib/mpp/server";
import { GET as freeGET } from "../../../../v1/stablecoins/[address]/risk/route";

export const dynamic = "force-dynamic";

export const GET = identityCharge(freeGET);
