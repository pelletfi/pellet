import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { readUserSession } from "@/lib/wallet/challenge-cookie";
import { db } from "@/lib/db/client";
import { walletUsers, walletSessions, walletSpendLog } from "@/lib/db/schema";
import { sql, eq, and, desc } from "drizzle-orm";
import { Dashboard } from "./Dashboard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Wallet Dashboard — Pellet",
  description: "Your Pellet Wallet — managed Tempo address, active agent sessions, payment history.",
};

export default async function WalletDashboardPage() {
  const userId = await readUserSession();
  if (!userId) {
    redirect("/wallet/sign-in");
  }

  const userRows = await db
    .select()
    .from(walletUsers)
    .where(eq(walletUsers.id, userId))
    .limit(1);
  const user = userRows[0];
  if (!user) redirect("/wallet/sign-in");

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
      createdAt: walletSessions.createdAt,
    })
    .from(walletSessions)
    .where(
      and(
        eq(walletSessions.userId, userId),
        sql`${walletSessions.bearerTokenHash} NOT LIKE 'pending-%'`,
      ),
    )
    .orderBy(desc(walletSessions.createdAt));

  const recentPayments = await db
    .select({
      id: walletSpendLog.id,
      sessionId: walletSpendLog.sessionId,
      recipient: walletSpendLog.recipient,
      amountWei: walletSpendLog.amountWei,
      txHash: walletSpendLog.txHash,
      status: walletSpendLog.status,
      createdAt: walletSpendLog.createdAt,
    })
    .from(walletSpendLog)
    .where(eq(walletSpendLog.userId, userId))
    .orderBy(desc(walletSpendLog.createdAt))
    .limit(50);

  return (
    <Dashboard
      user={{
        id: user.id,
        managedAddress: user.managedAddress,
        displayName: user.displayName,
      }}
      sessions={sessions.map((s) => ({
        id: s.id,
        label: s.label,
        spendCapWei: s.spendCapWei,
        spendUsedWei: s.spendUsedWei,
        perCallCapWei: s.perCallCapWei,
        expiresAt: s.expiresAt.toISOString(),
        revokedAt: s.revokedAt?.toISOString() ?? null,
        authorizeTxHash: s.authorizeTxHash,
        createdAt: s.createdAt.toISOString(),
      }))}
      payments={recentPayments.map((p) => ({
        id: p.id,
        sessionId: p.sessionId,
        recipient: p.recipient,
        amountWei: p.amountWei,
        txHash: p.txHash,
        status: p.status,
        createdAt: p.createdAt.toISOString(),
      }))}
    />
  );
}
