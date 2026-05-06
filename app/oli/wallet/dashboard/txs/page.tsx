import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { readUserSession } from "@/lib/wallet/challenge-cookie";
import { db } from "@/lib/db/client";
import { walletSpendLog } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { SpecimenPaymentRow } from "@/components/oli/SpecimenPaymentRow";
import { WalletTabs } from "@/components/oli/WalletTabs";

export const metadata: Metadata = {
  title: "Transactions — Pellet Wallet",
  description: "Full payment history for your Pellet Wallet.",
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function OliWalletTxsPage() {
  const userId = await readUserSession();
  if (!userId) redirect("/oli/wallet/sign-in");

  const payments = await db
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
    .limit(200);

  const rows = payments.map((p) => ({
    id: p.id,
    sessionId: p.sessionId,
    recipient: p.recipient,
    amountWei: p.amountWei,
    txHash: p.txHash,
    status: p.status,
    createdAt: p.createdAt.toISOString(),
  }));

  return (
    <div className="spec-wallet-float">
      <section className="spec-page-header">
        <div className="spec-page-header-row">
          <h1 className="spec-page-title">
            <span>Transactions</span>
          </h1>
          <div className="spec-wallet-tabs-float">
            <WalletTabs basePath="/oli/wallet" />
          </div>
        </div>
        <div className="spec-page-subhead">
          <span className="spec-subhead-pair">
            <span className="spec-page-subhead-label">TOTAL</span>
            <span>{rows.length} payment{rows.length === 1 ? "" : "s"}</span>
          </span>
          {rows.length === 200 && (
            <span className="spec-subhead-pair">
              <span className="spec-page-subhead-label">SHOWING</span>
              <span>latest 200</span>
            </span>
          )}
        </div>
      </section>

      <section style={{ paddingBottom: 48 }}>
        <div className="spec-rail-payments">
          <div className="spec-col-head">
            <span className="spec-col-head-left">SIGNED PAYMENTS</span>
            <span className="spec-col-head-right">
              <span>{rows.length} total</span>
            </span>
          </div>

          {rows.length === 0 ? (
            <div style={{ padding: "32px 0", opacity: 0.5, fontSize: 12, textAlign: "center" }}>
              No transactions yet. Payments will appear here once an agent session is active.
            </div>
          ) : (
            rows.map((p) => (
              <SpecimenPaymentRow key={p.id} payment={p} basePath="/oli/wallet" />
            ))
          )}

          {rows.length > 0 && (
            <div style={{ paddingTop: 16, fontSize: 11, opacity: 0.5, textAlign: "center" }}>
              <Link href="/oli/wallet/dashboard" className="spec-rail-payments-link">
                ← Back to dashboard
              </Link>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
