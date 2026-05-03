import { db } from "@/lib/db/client";
import { walletUsers, walletSessions, walletSpendLog } from "@/lib/db/schema";
import { sql, eq, and, desc } from "drizzle-orm";
import { readWalletBalances } from "@/lib/wallet/tempo-balance";
import { listConnectedAgents } from "@/lib/db/wallet-agent-connections";

export type DashboardData = {
  user: {
    id: string;
    managedAddress: string;
    displayName: string | null;
  };
  balances: Array<{
    symbol: string;
    address: string;
    display: string;
    rawWei: string;
  }>;
  chart: Array<{ label: string; spentUsdc: number }>;
  sessions: Array<{
    id: string;
    label: string | null;
    spendCapWei: string;
    spendUsedWei: string;
    perCallCapWei: string;
    expiresAt: string;
    revokedAt: string | null;
    authorizeTxHash: string | null;
    createdAt: string;
  }>;
  payments: Array<{
    id: string;
    sessionId: string;
    recipient: string;
    amountWei: string;
    txHash: string | null;
    status: string;
    createdAt: string;
  }>;
  agents: Array<{
    id: string;
    clientId: string;
    clientName: string;
    clientType: string;
    scopes: string[];
    tokenState: string;
    lastSeenAt: string;
    webhookEnabled: boolean;
    sessionId: string | null;
  }>;
};

export async function loadDashboardData(userId: string): Promise<DashboardData | null> {
  const userRows = await db
    .select()
    .from(walletUsers)
    .where(eq(walletUsers.id, userId))
    .limit(1);
  const user = userRows[0];
  if (!user) return null;

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

  let balances: Awaited<ReturnType<typeof readWalletBalances>> = [];
  try {
    balances = await readWalletBalances(user.managedAddress as `0x${string}`);
  } catch {
    /* leave empty; UI falls back gracefully */
  }
  const agents = await listConnectedAgents(userId);

  return {
    user: {
      id: user.id,
      managedAddress: user.managedAddress,
      displayName: user.displayName,
    },
    balances: balances.map((b) => ({
      symbol: b.symbol,
      address: b.address,
      display: b.display,
      rawWei: b.raw.toString(),
    })),
    chart,
    sessions: sessions.map((s) => ({
      id: s.id,
      label: s.label,
      spendCapWei: s.spendCapWei,
      spendUsedWei: s.spendUsedWei,
      perCallCapWei: s.perCallCapWei,
      expiresAt: s.expiresAt.toISOString(),
      revokedAt: s.revokedAt?.toISOString() ?? null,
      authorizeTxHash: s.authorizeTxHash,
      createdAt: s.createdAt.toISOString(),
    })),
    payments: recentPayments.map((p) => ({
      id: p.id,
      sessionId: p.sessionId,
      recipient: p.recipient,
      amountWei: p.amountWei,
      txHash: p.txHash,
      status: p.status,
      createdAt: p.createdAt.toISOString(),
    })),
    agents: agents.map((agent) => ({
      id: agent.id,
      clientId: agent.clientId,
      clientName: agent.clientName,
      clientType: agent.clientType,
      scopes: agent.scopes,
      tokenState: agent.tokenState,
      lastSeenAt: agent.lastSeenAt.toISOString(),
      webhookEnabled: agent.webhookEnabled,
      sessionId: agent.sessionId,
    })),
  };
}

function build7dChart(
  rows: Array<{ day: string; spent_wei: string }>,
): Array<{ label: string; spentUsdc: number }> {
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
