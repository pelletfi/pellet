/**
 * GET /api/mpp/stablecoins/[address]/peg
 *
 * Zero-charge MPP mirror of /api/v1/stablecoins/[address]/peg.
 */

import { identityCharge } from "@/lib/mpp/server";
import { GET as freeGET } from "../../../../v1/stablecoins/[address]/peg/route";

export const dynamic = "force-dynamic";

export const GET = identityCharge(freeGET);
