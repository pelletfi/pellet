/**
 * GET /api/mpp/stablecoins/[address]/reserves
 *
 * $0.020 MPP analytics — total backing + per-reserve-type composition with
 * attestation source and issuer. Priced at the analytics tier per the v2
 * pricing schedule (attestation mapping + source resolution on top of a
 * lookup).
 */

import { analyticsCharge } from "@/lib/mpp/server";
import { GET as freeGET } from "../../../../v1/stablecoins/[address]/reserves/route";

export const dynamic = "force-dynamic";

export const GET = analyticsCharge(freeGET);
