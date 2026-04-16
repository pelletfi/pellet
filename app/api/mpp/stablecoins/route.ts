/**
 * GET /api/mpp/stablecoins
 *
 * Zero-charge MPP mirror of /api/v1/stablecoins — same response, wrapped in
 * an MPP identity challenge so MPPScan surfaces it in the directory listing
 * alongside paid routes. Clients pay $0 (just prove wallet identity via a
 * signed voucher) and receive the full stablecoin matrix.
 *
 * Pattern popularized by GovLaws, StableEnrich, etc. — these FREE tags in
 * the MPPScan UI are really `authMode: "paid"` with `price: "0.000000"`.
 */

import { identityCharge } from "@/lib/mpp/server";
import { GET as freeGET } from "../../v1/stablecoins/route";

export const dynamic = "force-dynamic";

export const GET = identityCharge(freeGET);
