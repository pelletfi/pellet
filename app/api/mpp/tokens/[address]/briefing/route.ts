/**
 * GET /api/mpp/tokens/[address]/briefing
 *
 * MPP-discoverable mirror of /api/v1/tokens/[address]/briefing. Same paid
 * flow ($0.05 USDC.e), same briefing output. Exists at the /api/mpp/*
 * prefix so MPPScan's crawler picks it up alongside the zero-charge free
 * mirrors — without this, the paid briefing is invisible in the MPPScan
 * directory (the crawler only probes /api/mpp/*).
 */

import { GET as paidGET } from "../../../../v1/tokens/[address]/briefing/route";

export const dynamic = "force-dynamic";

// The v1 route already has briefingCharge applied; just re-export here.
// Re-wrapping would compose two charge layers, which would break — the
// client would be asked to pay twice.
export const GET = paidGET;
