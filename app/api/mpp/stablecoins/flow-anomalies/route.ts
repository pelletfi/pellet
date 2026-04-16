/**
 * GET /api/mpp/stablecoins/flow-anomalies
 *
 * Zero-charge MPP mirror of /api/v1/stablecoins/flow-anomalies.
 */

import { identityCharge } from "@/lib/mpp/server";
import { GET as freeGET } from "../../../v1/stablecoins/flow-anomalies/route";

export const dynamic = "force-dynamic";

export const GET = identityCharge(freeGET);
