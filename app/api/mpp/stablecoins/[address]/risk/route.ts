/**
 * GET /api/mpp/stablecoins/[address]/risk
 *
 * $0.050 MPP composite — composite risk score 0–100 with explainable
 * sub-scores (peg_risk, peg_break_risk, supply_risk, policy_risk). This is
 * synthesis work (four sub-components + weighted composite), priced above
 * raw lookups per the v2 pricing schedule.
 */

import { compositeCharge } from "@/lib/mpp/server";
import { GET as freeGET } from "../../../../v1/stablecoins/[address]/risk/route";

export const dynamic = "force-dynamic";

export const GET = compositeCharge(freeGET);
