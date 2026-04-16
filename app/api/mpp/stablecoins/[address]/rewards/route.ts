/**
 * GET /api/mpp/stablecoins/[address]/rewards
 *
 * Zero-charge MPP mirror of /api/v1/stablecoins/[address]/rewards.
 */

import { identityCharge } from "@/lib/mpp/server";
import { GET as freeGET } from "../../../../v1/stablecoins/[address]/rewards/route";

export const dynamic = "force-dynamic";

export const GET = identityCharge(freeGET);
