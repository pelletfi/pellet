/**
 * GET /api/mpp/stablecoins/flows
 *
 * Zero-charge MPP mirror of /api/v1/stablecoins/flows.
 */

import { identityCharge } from "@/lib/mpp/server";
import { GET as freeGET } from "../../../v1/stablecoins/flows/route";

export const dynamic = "force-dynamic";

export const GET = identityCharge(freeGET);
