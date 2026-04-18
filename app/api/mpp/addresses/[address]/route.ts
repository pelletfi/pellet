/**
 * GET /api/mpp/addresses/{address}
 *
 * $0.010 MPP lookup — wallet intelligence (ERC-8004 agent status + TIP-403
 * role forensics + address label). Priced as a standard on-chain lookup
 * (Allium-tier) per the v2 pricing schedule (2026-04-17).
 */

import { lookupCharge } from "@/lib/mpp/server";
import { GET as freeGET } from "../../../v1/addresses/[address]/route";

export const dynamic = "force-dynamic";

export const GET = lookupCharge(freeGET);
