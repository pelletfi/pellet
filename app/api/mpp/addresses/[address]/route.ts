/**
 * GET /api/mpp/addresses/{address}
 *
 * Zero-charge MPP mirror of /api/v1/addresses/{address}. Full wallet
 * intelligence returned via the MPP identity flow so MPPScan indexes the
 * endpoint alongside the pre-trade oracle + stablecoin mirrors.
 */

import { identityCharge } from "@/lib/mpp/server";
import { GET as freeGET } from "../../../v1/addresses/[address]/route";

export const dynamic = "force-dynamic";

export const GET = identityCharge(freeGET);
