/**
 * GET /api/mpp/stablecoins/[address]/reserves
 *
 * Zero-charge MPP mirror of /api/v1/stablecoins/[address]/reserves.
 */

import { identityCharge } from "@/lib/mpp/server";
import { GET as freeGET } from "../../../../v1/stablecoins/[address]/reserves/route";

export const dynamic = "force-dynamic";

export const GET = identityCharge(freeGET);
