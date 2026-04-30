import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { walletUsers, walletSessions, walletSpendLog } from "@/lib/db/schema";
import { readUserSession } from "@/lib/wallet/challenge-cookie";
import { sql, eq, and, ne, desc } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// /api/wallet/me — returns the authenticated user's full wallet state.
// Backs the human-facing /wallet/dashboard. Cookie-authenticated via the
// 30min user session set during WebAuthn auth/verify.

export async function GET() {
  const userId = await readUserSession();
  if (!userId) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }

  const userRows = await db
    .select()
    .from(walletUsers)
    .where(eq(walletUsers.id, userId))
    .limit(1);
  const user = userRows[0];
  if (!user) {
    return NextResponse.json({ error: "user not found" }, { status: 404 });
  }

  // Active sessions — exclude pending sentinels (orphan rows from abandoned
  // pairings) and revoked rows.
  const sessions = await db
    .select({
      id: walletSessions.id,
      label: walletSessions.label,
      spendCapWei: walletSessions.spendCapWei,
      spendUsedWei: walletSessions.spendUsedWei,
      perCallCapWei: walletSessions.perCallCapWei,
      expiresAt: walletSessions.expiresAt,
      revokedAt: walletSessions.revokedAt,
      authorizeTxHash: walletSessions.authorizeTxHash,
      onChainAuthorizedAt: walletSessions.onChainAuthorizedAt,
      createdAt: walletSessions.createdAt,
    })
    .from(walletSessions)
    .where(
      and(
        eq(walletSessions.userId, userId),
        ne(walletSessions.bearerTokenHash, sql`'pending-' || ${walletSessions.id}::text`),
        sql`${walletSessions.bearerTokenHash} NOT LIKE 'pending-%'`,
      ),
    )
    .orderBy(desc(walletSessions.createdAt));

  // Recent payments (last 50) joined to session label for display.
  const payments = await db.execute<{
    id: string;
    session_id: string;
    session_label: string | null;
    challenge_id: string | null;
    recipient: string;
    amount_wei: string;
    tx_hash: string | null;
    status: string;
    reason: string | null;
    created_at: Date | string;
  }>(sql`
    SELECT
      sp.id::text                           AS id,
      sp.session_id::text                   AS session_id,
      ws.label                              AS session_label,
      sp.challenge_id                       AS challenge_id,
      sp.recipient                          AS recipient,
      sp.amount_wei                         AS amount_wei,
      sp.tx_hash                            AS tx_hash,
      sp.status                             AS status,
      sp.reason                             AS reason,
      sp.created_at                         AS created_at
    FROM wallet_spend_log sp
    LEFT JOIN wallet_sessions ws ON ws.id = sp.session_id
    WHERE sp.user_id = ${userId}
    ORDER BY sp.created_at DESC
    LIMIT 50
  `);

  return NextResponse.json({
    user: {
      id: user.id,
      managed_address: user.managedAddress,
      display_name: user.displayName,
      created_at: user.createdAt,
      last_seen_at: user.lastSeenAt,
    },
    sessions: sessions.map((s) => ({
      id: s.id,
      label: s.label,
      spend_cap_wei: s.spendCapWei,
      spend_used_wei: s.spendUsedWei,
      per_call_cap_wei: s.perCallCapWei,
      expires_at: s.expiresAt,
      revoked_at: s.revokedAt,
      authorize_tx_hash: s.authorizeTxHash,
      on_chain_authorized_at: s.onChainAuthorizedAt,
      created_at: s.createdAt,
    })),
    payments: payments.rows.map((p) => ({
      id: p.id,
      session_id: p.session_id,
      session_label: p.session_label,
      challenge_id: p.challenge_id,
      recipient: p.recipient,
      amount_wei: p.amount_wei,
      tx_hash: p.tx_hash,
      status: p.status,
      reason: p.reason,
      created_at: p.created_at,
    })),
  });
}
