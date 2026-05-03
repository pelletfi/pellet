import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { readUserSession } from "@/lib/wallet/challenge-cookie";
import { db } from "@/lib/db/client";
import { walletSessions, walletSpendLog } from "@/lib/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { SessionDetail } from "./SessionDetail";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Session — Pellet Wallet",
  description: "Cap-usage history and payment activity for a single agent session.",
};

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  redirect("/wallet");
}

export async function renderSession(
  params: Promise<{ id: string }>,
  basePath: string,
) {
  const userId = await readUserSession();
  if (!userId) redirect(`${basePath}/sign-in`);

  const { id } = await params;

  const rows = await db
    .select()
    .from(walletSessions)
    .where(and(eq(walletSessions.id, id), eq(walletSessions.userId, userId)))
    .limit(1);
  const session = rows[0];
  if (!session) notFound();

  const payments = await db
    .select({
      id: walletSpendLog.id,
      recipient: walletSpendLog.recipient,
      amountWei: walletSpendLog.amountWei,
      txHash: walletSpendLog.txHash,
      status: walletSpendLog.status,
      createdAt: walletSpendLog.createdAt,
    })
    .from(walletSpendLog)
    .where(eq(walletSpendLog.sessionId, id))
    .orderBy(asc(walletSpendLog.createdAt));

  return (
    <SessionDetail
      session={{
        id: session.id,
        label: session.label,
        spendCapWei: session.spendCapWei,
        spendUsedWei: session.spendUsedWei,
        perCallCapWei: session.perCallCapWei,
        expiresAt: session.expiresAt.toISOString(),
        revokedAt: session.revokedAt?.toISOString() ?? null,
        authorizeTxHash: session.authorizeTxHash,
        createdAt: session.createdAt.toISOString(),
      }}
      payments={payments.map((p) => ({
        id: p.id,
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
