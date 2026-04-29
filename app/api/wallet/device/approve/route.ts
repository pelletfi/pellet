import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { walletDevicePairings, walletUsers } from "@/lib/db/schema";
import { readUserSession } from "@/lib/wallet/challenge-cookie";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Phase 2 — requires an authenticated user (set via WebAuthn register or
// auth flows). Phase 3 will additionally chain an on-chain
// AccountKeychain.authorizeKey tx before marking the pairing approved.

type ApproveBody = {
  code: string;
  spend_cap_wei: string;
  per_call_cap_wei: string;
  session_ttl_seconds: number;
};

export async function POST(req: Request) {
  // 1. Must be authenticated.
  const userId = await readUserSession();
  if (!userId) {
    return NextResponse.json(
      { error: "not authenticated", detail: "complete passkey enrollment first" },
      { status: 401 },
    );
  }
  const userRows = await db
    .select({ id: walletUsers.id })
    .from(walletUsers)
    .where(eq(walletUsers.id, userId))
    .limit(1);
  if (userRows.length === 0) {
    return NextResponse.json({ error: "user not found" }, { status: 401 });
  }

  // 2. Validate body.
  let body: ApproveBody;
  try {
    body = (await req.json()) as ApproveBody;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  if (!body.code || !body.spend_cap_wei || !body.per_call_cap_wei || !body.session_ttl_seconds) {
    return NextResponse.json({ error: "missing required fields" }, { status: 400 });
  }

  // 3. Look up + validate the pairing.
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
  if (pairing.expiresAt.getTime() < Date.now()) {
    await db
      .update(walletDevicePairings)
      .set({ status: "expired" })
      .where(eq(walletDevicePairings.id, pairing.id));
    return NextResponse.json({ error: "code expired" }, { status: 410 });
  }

  // 4. Mark approved against the authenticated user. (Phase 3: also submit
  // AccountKeychain.authorizeKey on Tempo here, persist the resulting
  // keyId on the wallet_session row.)
  await db
    .update(walletDevicePairings)
    .set({
      status: "approved",
      approvedAt: new Date(),
      approvedUserId: userId,
      approvedSpendCapWei: body.spend_cap_wei,
      approvedPerCallCapWei: body.per_call_cap_wei,
      approvedSessionTtlSeconds: body.session_ttl_seconds,
    })
    .where(eq(walletDevicePairings.id, pairing.id));

  return NextResponse.json({ ok: true });
}
