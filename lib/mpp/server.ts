/**
 * lib/mpp/server.ts
 *
 * Singleton mppx instance configured for Tempo pathUSD payments.
 *
 * The `briefingCharge` export is a higher-order function that wraps a Next.js
 * route handler with $0.05 pathUSD MPP payment gating.
 *
 * Usage:
 *   export const GET = briefingCharge(async (req, ctx) => {
 *     return NextResponse.json({ ... });
 *   });
 *
 * Environment variables required in production:
 *   MPP_SECRET_KEY   — HMAC key for binding challenges (auto-read from env)
 *   MPP_RECIPIENT    — 0x address to receive pathUSD payments
 */

import { Mppx, tempo } from "mppx/server";
import type { NextRequest } from "next/server";
import { TEMPO_ADDRESSES } from "@/lib/types";

// ── Lazy singleton ─────────────────────────────────────────────────────────────
// Deferred so missing env vars at module-load time don't crash the Next.js build.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _mppx: any | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getMppx(): any {
  if (_mppx) return _mppx;

  const recipient = process.env.MPP_RECIPIENT as `0x${string}` | undefined;
  if (!recipient) {
    throw new Error(
      "MPP_RECIPIENT environment variable is required for payment gating."
    );
  }

  // Use tempo.charge() directly (not tempo()) so that `charge` is the only
  // registered intent — this makes mppx.charge a unique shorthand.
  // Currency is USDC.e: the ecosystem-standard MPP payment token on Tempo
  // (see tempoxyz/mpp schemas — TEMPO_PAYMENT uses USDC.e, 6 decimals).
  // Charging in USDC.e keeps Pellet compatible with every standard MPP client
  // and the `tempo wallet services` directory.
  //
  // Realm is explicit: mppx defaults to VERCEL_URL which resolves to the
  // deployment subdomain (e.g. pellet-g21yr5bur-pellet.vercel.app). That
  // breaks MPPScan attribution because the realm mismatches the origin host.
  // Lock realm to pelletfi.com so on-chain payment stats are correctly
  // attributed to the production hostname.
  _mppx = Mppx.create({
    realm: "pelletfi.com",
    methods: [
      tempo.charge({
        currency: TEMPO_ADDRESSES.usdcE,
        recipient,
      }),
    ],
    // Auto-reads MPP_SECRET_KEY from env; throws if missing
    secretKey: process.env.MPP_SECRET_KEY,
  });

  return _mppx;
}

// ── Route handler types ────────────────────────────────────────────────────────

type RouteContext = { params: Promise<Record<string, string>> };

type MppHandler = (
  request: NextRequest,
  context: RouteContext
) => Promise<Response>;

// ── briefingCharge ─────────────────────────────────────────────────────────────

/**
 * Wraps a Next.js route handler with $0.05 pathUSD payment gating via MPP.
 *
 * - If payment credentials are absent or invalid, returns a 402 challenge so
 *   the MPP client knows the amount, currency, and recipient to pay.
 * - If payment is verified, runs the handler and attaches a Payment-Receipt
 *   header to the response.
 * - If MPP_RECIPIENT or MPP_SECRET_KEY are not set (dev mode), the handler
 *   runs without payment enforcement — a warning is logged.
 */
export function briefingCharge(handler: MppHandler): MppHandler {
  return async (request: NextRequest, context: RouteContext) => {
    // Dev fallback: skip payment when env vars are missing
    if (!process.env.MPP_RECIPIENT || !process.env.MPP_SECRET_KEY) {
      console.warn(
        "[mpp] MPP_RECIPIENT or MPP_SECRET_KEY not set — payment gating DISABLED. " +
          "Set both env vars in production."
      );
      return handler(request, context);
    }

    const mppx = getMppx();

    // Run the MPP charge flow: verifies the Authorization header credential
    // against the challenge we previously issued for this endpoint.
    const result = await mppx.charge({
      amount: "0.05",
      description: "Pellet deep briefing",
    })(request);

    if (result.status === 402) {
      // No valid payment credential — return the challenge response.
      // The MPP client reads WWW-Authenticate headers to know how much to pay.
      return result.challenge as Response;
    }

    // Payment verified — run the handler and attach the receipt header.
    const handlerResponse = await handler(request, context);
    return result.withReceipt(handlerResponse);
  };
}

// Re-export for callers that need the raw mppx instance (e.g. session endpoints)
export { getMppx as mppx };
