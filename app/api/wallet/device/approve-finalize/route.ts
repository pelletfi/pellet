import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { walletDevicePairings, walletSessions } from "@/lib/db/schema";
import { readUserSession } from "@/lib/wallet/challenge-cookie";
import { eq, and } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Phase 3.B.2 step 2 — the browser has just completed the passkey-signed
// authorizeKey TempoTransaction (sponsored gas, broadcast to Moderato) and
// is reporting back the tx hash. We mark the pairing approved and persist
// the tx hash on the wallet_session that /approve-init pre-created.
//
// Phase 3.B.3 will add server-side receipt verification (re-fetch the tx
// from the chain, confirm status=1, confirm getKey returns the right
// caps, etc.) to defend against a malicious browser lying about the hash.

type FinalizeBody = {
  code: string;
  tx_hash: string;
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
  if (!body.code || !body.tx_hash) {
    return NextResponse.json({ error: "missing code or tx_hash" }, { status: 400 });
  }
  if (!/^0x[0-9a-fA-F]{64}$/.test(body.tx_hash)) {
    return NextResponse.json({ error: "tx_hash must be 0x + 64 hex" }, { status: 400 });
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

  // Locate the pre-created session row (sentinel bearer hash).
  const sentinel = `pending-${pairing.id}`;
  await db
    .update(walletSessions)
    .set({
      authorizeTxHash: body.tx_hash,
      onChainAuthorizedAt: new Date(),
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

  return NextResponse.json({ ok: true });
}
