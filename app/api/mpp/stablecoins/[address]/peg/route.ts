/**
 * GET /api/mpp/stablecoins/[address]/peg
 *
 * $0.010 MPP lookup — peg sample + 1h/24h/7d aggregates. Sub-bp accuracy
 * vs. aggregator oracle estimates is the category story; priced at the
 * standard lookup tier (Allium-tier) per the v2 pricing schedule.
 */

import { lookupCharge } from "@/lib/mpp/server";
import { GET as freeGET } from "../../../../v1/stablecoins/[address]/peg/route";

export const dynamic = "force-dynamic";

export const GET = lookupCharge(freeGET);
