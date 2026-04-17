/**
 * GET /api/mpp/tip403/simulate
 *
 * Zero-charge MPP mirror of /api/v1/tip403/simulate. Same response; wrapped
 * in an MPP identity challenge so MPPScan indexes it alongside Pellet's
 * other free routes. Agents go through the 402 challenge, sign an identity
 * voucher with no USDC.e transfer, and receive the same simulation result.
 */

import { identityCharge } from "@/lib/mpp/server";
import { GET as freeGET } from "../../../v1/tip403/simulate/route";

export const dynamic = "force-dynamic";

export const GET = identityCharge(freeGET);
