import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { walletDevicePairings, walletSessions, walletUsers } from "@/lib/db/schema";
import { readUserSession } from "@/lib/wallet/challenge-cookie";
import { eq, and } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Deferred-authorize finalize. Pre-2026-05-09 this endpoint pulled the
// AccountKeychain.authorizeKey receipt off-chain and verified KeyAuthorized
// before issuing the bearer. That coupled signup to Tempo's relay/RPC
// availability — a dry FeeAMM pool wedged the whole flow.
//
// Now: the browser passkey-signs the tx envelope but does NOT broadcast.
// It POSTs the raw signed bytes here. We persist the bytes on the
// pre-created wallet_session row (state='pending'), flip the pairing to
// 'approved', and let /poll mint the bearer immediately. Lazy broadcast
// happens at first spend (lib/wallet/lazy-authorize.ts).

type FinalizeBody = {
  code: string;
  raw_tx: string;
  valid_before_unix: number;
};

export async function POST(req: Request) {
  const userId = await readUserSession();
  if (!userId) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }

  let body: FinalizeBody;
  try {
    body = (await req.json()) as FinalizeBody;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  if (!body.code || !body.raw_tx || !body.valid_before_unix) {
    return NextResponse.json(
      { error: "missing code, raw_tx, or valid_before_unix" },
      { status: 400 },
    );
  }
  if (!/^0x[0-9a-fA-F]+$/.test(body.raw_tx)) {
    return NextResponse.json({ error: "raw_tx must be 0x hex" }, { status: 400 });
  }
  // Tempo envelope types: 0x76 (without feePayerSignature) and 0x78
  // (with it). Both are valid here — feePayer:true means the relay
  // attaches a sig later. Sanity-check the leading byte so we don't store
  // junk like a bare ECDSA legacy tx.
  const prefix = body.raw_tx.slice(0, 4).toLowerCase();
  if (prefix !== "0x76" && prefix !== "0x78") {
    return NextResponse.json(
      {
        error: "raw_tx is not a Tempo envelope (type 0x76 or 0x78)",
        detail: `prefix=${prefix}`,
      },
      { status: 400 },
    );
  }
  if (
    body.valid_before_unix < Math.floor(Date.now() / 1000) ||
    body.valid_before_unix > Math.floor(Date.now() / 1000) + 7 * 86400
  ) {
    return NextResponse.json(
      { error: "valid_before_unix must be within 7d of now" },
      { status: 400 },
    );
  }

  const rows = await db
    .select()
    .from(walletDevicePairings)
    .where(eq(walletDevicePairings.code, body.code))
    .limit(1);
  const pairing = rows[0];
  if (!pairing) {
    return NextResponse.json({ error: "code not found" }, { status: 404 });
  }
  if (pairing.status !== "pending") {
    return NextResponse.json({ error: `pairing is ${pairing.status}` }, { status: 409 });
  }
  if (pairing.approvedUserId !== userId) {
    return NextResponse.json(
      { error: "pairing was initialized by a different user" },
      { status: 403 },
    );
  }

  // Sanity-check the user has a managed address on file. We don't decode
  // the tx envelope here (would require full Tempo RLP parsing); decode
  // and signature verification happen in the lazy-broadcast path where we
  // have viem's deserialize at hand.
  const userRows = await db
    .select({ managedAddress: walletUsers.managedAddress })
    .from(walletUsers)
    .where(eq(walletUsers.id, userId))
    .limit(1);
  if (!userRows[0]?.managedAddress) {
    return NextResponse.json({ error: "user not found" }, { status: 404 });
  }

  const sentinel = `pending-${pairing.id}`;
  const validBefore = new Date(body.valid_before_unix * 1000);

  await db
    .update(walletSessions)
    .set({
      authorizeTxSigned: body.raw_tx,
      authorizeState: "pending",
      authorizeAttempts: 0,
      authorizeLastError: null,
      authorizeValidBefore: validBefore,
    })
    .where(
      and(
        eq(walletSessions.bearerTokenHash, sentinel),
        eq(walletSessions.userId, userId),
      ),
    );

  await db
    .update(walletDevicePairings)
    .set({
      status: "approved",
      approvedAt: new Date(),
    })
    .where(eq(walletDevicePairings.id, pairing.id));

  return NextResponse.json({
    ok: true,
    deferred: true,
    valid_before: validBefore.toISOString(),
  });
}
