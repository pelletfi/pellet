/**
 * GET /api/mpp/stablecoins/flows
 *
 * $0.010 MPP lookup — hourly DEX flow topology between Tempo stables.
 * Standard analytics lookup tier per the v2 pricing schedule.
 */

import { lookupCharge } from "@/lib/mpp/server";
import { GET as freeGET } from "../../../v1/stablecoins/flows/route";

export const dynamic = "force-dynamic";

export const GET = lookupCharge(freeGET);
