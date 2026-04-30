import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { walletSessions } from "@/lib/db/schema";
import { readUserSession } from "@/lib/wallet/challenge-cookie";
import { eq, and } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Server-side revoke. Marks wallet_sessions.revoked_at; future /api/wallet/pay
// calls with this bearer immediately fail-fast. The on-chain access key
// remains authorized via AccountKeychain until expiry — Phase 6+ wires
// AccountKeychain.revokeKey via a fresh passkey assertion to also kill
// the on-chain capability instantly.

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const userId = await readUserSession();
  if (!userId) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }

  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: "session id required" }, { status: 400 });
  }

  // Only the owner of the session can revoke it.
  const result = await db
    .update(walletSessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(walletSessions.id, id), eq(walletSessions.userId, userId)))
    .returning({ id: walletSessions.id });

  if (result.length === 0) {
    return NextResponse.json(
      { error: "session not found or not owned by you" },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ok: true,
    note: "Bearer is now dead server-side. On-chain access key remains authorized until expiry; will revoke via AccountKeychain in a follow-up release.",
  });
}
