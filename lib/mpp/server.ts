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
  // NOTE: mppx currently keys methods by `${name}/${intent}` (= `tempo/charge`),
  // so two tempo.charge() entries with different currencies collide and
  // break the mppx.charge shorthand. Multi-currency support would need a
  // different configuration pattern (e.g. per-request dynamic method
  // selection). For now we charge in USDC.e only; clients with pathUSD
  // can swap via the enshrined DEX before calling.
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

// Generic over context so route handlers with specific param shapes (e.g.
// { params: Promise<{ address: string }> }) can be wrapped without TS complaining.
// Next.js's route-context object is always supplied by the framework, so we
// just pass it through unchanged.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MppHandler<TContext = any> = (
  request: NextRequest,
  context: TContext
) => Promise<Response>;

// ── briefingCharge ─────────────────────────────────────────────────────────────

/**
 * Wraps a Next.js route handler with an MPP charge at the specified amount.
 *
 * - If payment credentials are absent or invalid, returns a 402 challenge so
 *   the MPP client knows the amount, currency, and recipient to pay.
 * - If payment is verified (even at amount=0, this acts as an identity proof),
 *   runs the handler and attaches a Payment-Receipt header to the response.
 * - If MPP_RECIPIENT or MPP_SECRET_KEY are not set (dev mode), the handler
 *   runs without payment enforcement — a warning is logged.
 *
 * Amount semantics:
 *   - "0" or "0.00"   → identity/challenge-only route. The client signs an
 *     MPP voucher but transfers no USDC.e. Useful for mirroring free endpoints
 *     under /api/mpp/* so MPPScan indexes and displays them alongside paid
 *     routes — the ecosystem convention popularized by GovLaws and others.
 *   - any positive     → actual payment.
 */
export function mppCharge(
  amount: string,
  description: string
) {
  return <TContext>(handler: MppHandler<TContext>): MppHandler<TContext> =>
    async (request: NextRequest, context: TContext) => {
      // Dev fallback: skip payment when env vars are missing
      if (!process.env.MPP_RECIPIENT || !process.env.MPP_SECRET_KEY) {
        console.warn(
          "[mpp] MPP_RECIPIENT or MPP_SECRET_KEY not set — payment gating DISABLED. " +
            "Set both env vars in production."
        );
        return handler(request, context);
      }

      try {
        const mppx = getMppx();

        // Run the MPP charge flow: verifies the Authorization header credential
        // against the challenge we previously issued for this endpoint.
        const result = await mppx.charge({
          amount,
          description,
        })(request);

        if (result.status === 402) {
          // No valid payment credential — return the challenge response.
          // The MPP client reads WWW-Authenticate headers to know how much to pay.
          return result.challenge as Response;
        }

        // Payment verified — run the handler and attach the receipt header.
        const handlerResponse = await handler(request, context);
        return result.withReceipt(handlerResponse);
      } catch (err) {
        // Diagnostic surface: we've been seeing opaque 500s on the zero-amount
        // mirror routes. Returning the error body lets us see what's failing
        // without having to tail runtime logs.
        console.error("[mpp-wrapper]", err);
        const msg = err instanceof Error ? err.message : String(err);
        const stack = err instanceof Error ? err.stack : undefined;
        return new Response(
          JSON.stringify({
            error: {
              code: "MPP_WRAPPER_ERROR",
              message: msg,
              stack: stack?.split("\n").slice(0, 8).join("\n"),
              amount,
            },
          }),
          {
            status: 500,
            headers: { "content-type": "application/json" },
          }
        );
      }
    };
}

/**
 * $0.05 MPP charge — the paid /briefing route.
 */
export const briefingCharge = mppCharge("0.05", "Pellet deep briefing");

/**
 * $0 MPP charge — mirrors free endpoints under /api/mpp/* so they appear in
 * the MPPScan directory alongside paid routes. Clients still go through the
 * 402 challenge flow (identity proof via wallet signature) but transfer no
 * USDC.e. Matches the pattern used by GovLaws, StableEnrich, and others
 * whose free routes show up with a "FREE" tag in the MPPScan UI.
 */
export const identityCharge = mppCharge(
  "0",
  "Pellet free route — MPP identity challenge, no charge"
);

// Re-export for callers that need the raw mppx instance (e.g. session endpoints)
export { getMppx as mppx };
