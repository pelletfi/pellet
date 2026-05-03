import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { readUserSession } from "@/lib/wallet/challenge-cookie";
import { db } from "@/lib/db/client";
import { walletUsers, walletSessions, walletSpendLog } from "@/lib/db/schema";
import { sql, eq, and, desc } from "drizzle-orm";
import { readWalletBalances } from "@/lib/wallet/tempo-balance";
import { Dashboard } from "./Dashboard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Wallet Dashboard — Pellet",
  description: "Your Pellet Wallet — managed Tempo address, active agent sessions, payment history.",
};

export default async function WalletDashboardPage() {
  redirect("/wallet");
}

/**
 * Shared renderer used by /wallet/dashboard and /oli/wallet/dashboard. The
 * OLI mirror passes basePath="/oli/wallet" so internal links + the
 * unauthenticated redirect target both keep the user inside the OLI shell.
 */
export async function renderDashboard(basePath: string) {
  const userId = await readUserSession();
  if (!userId) {
    redirect(`${basePath}/sign-in`);
  }

  const userRows = await db
    .select()
    .from(walletUsers)
    .where(eq(walletUsers.id, userId))
    .limit(1);
  const user = userRows[0];
  if (!user) redirect(`${basePath}/sign-in`);

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

  // 7-day spend chart data — bucketed by day (UTC), zero-filled across
  // the full window so the chart shape is consistent regardless of how
  // many days have actual activity.
  const chartRows = await db.execute<{ day: string; spent_wei: string }>(sql`
    SELECT
      to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
      SUM(amount_wei::numeric)::text                       AS spent_wei
    FROM wallet_spend_log
    WHERE user_id = ${userId}
      AND status IN ('signed', 'submitted', 'confirmed')
      AND created_at > now() - interval '7 days'
    GROUP BY day
    ORDER BY day ASC
  `);
  const chart = build7dChart(chartRows.rows);

  // Live on-chain balances (USDC.e + pathUSD on testnet). Cheap; one RPC
  // multicall via viem. Fails open: if RPC blips we render zeros + a note.
  let balances: Awaited<ReturnType<typeof readWalletBalances>> = [];
  try {
    balances = await readWalletBalances(user.managedAddress as `0x${string}`);
  } catch {
    /* leave empty; UI falls back gracefully */
  }

  return (
    <Dashboard
      user={{
        id: user.id,
        managedAddress: user.managedAddress,
        displayName: user.displayName,
      }}
      balances={balances.map((b) => ({
        symbol: b.symbol,
        address: b.address,
        display: b.display,
        rawWei: b.raw.toString(),
      }))}
      chart={chart}
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
      basePath={basePath}
    />
  );
}

function build7dChart(
  rows: Array<{ day: string; spent_wei: string }>,
): Array<{ label: string; spentUsdc: number }> {
  // Build a map of YYYY-MM-DD → wei sum
  const byDay = new Map(rows.map((r) => [r.day, r.spent_wei]));
  const out: Array<{ label: string; spentUsdc: number }> = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const wei = byDay.get(iso) ?? "0";
    out.push({
      label: d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
      spentUsdc: Number(wei) / 1_000_000,
    });
  }
  return out;
}
