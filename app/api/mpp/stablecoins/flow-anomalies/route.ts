/**
 * GET /api/mpp/stablecoins/flow-anomalies
 *
 * $0.020 MPP analytics — ≥3σ flow anomalies in 15-minute windows. Derived
 * from the flows feed + rolling z-score baseline; priced above raw flows
 * per the v2 pricing schedule.
 */

import { analyticsCharge } from "@/lib/mpp/server";
import { GET as freeGET } from "../../../v1/stablecoins/flow-anomalies/route";

export const dynamic = "force-dynamic";

export const GET = analyticsCharge(freeGET);
