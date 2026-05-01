import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { readUserSession } from "@/lib/wallet/challenge-cookie";
import { loadDashboardData } from "@/lib/wallet/dashboard-data";
import { SpecimenWalletDashboard } from "./SpecimenWalletDashboard";

export const metadata: Metadata = {
  title: "Wallet Dashboard — Pellet",
  description: "Your Pellet Wallet — managed Tempo address, active agent sessions, payment history.",
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function OliWalletDashboardPage() {
  const userId = await readUserSession();
  if (!userId) redirect("/oli/wallet/sign-in");

  const data = await loadDashboardData(userId);
  if (!data) redirect("/oli/wallet/sign-in");

  return (
    <SpecimenWalletDashboard
      user={data.user}
      balances={data.balances}
      chart={data.chart}
      sessions={data.sessions}
      payments={data.payments}
      basePath="/oli/wallet"
    />
  );
}
