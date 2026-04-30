import type { Metadata } from "next";
import { redirect } from "next/navigation";
import WalletPage from "@/app/wallet/page";
import { readUserSession } from "@/lib/wallet/challenge-cookie";

export const metadata: Metadata = {
  title: "Pellet Wallet",
  description:
    "An open agent wallet on Tempo. Public ledger. Self-custody. Every payment recorded for anyone to read.",
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Renders the canonical /wallet landing inside the OLI shell. If the user is
// already signed in, jump straight to their dashboard instead of showing the
// marketing landing — when they click "Pellet Wallet" from the OLI sidebar
// after signing in, they expect to see their wallet, not the explainer.
// The /wallet canonical route stays as the explainer landing for direct
// visitors regardless of auth state.
export default async function OliEmbeddedWalletPage() {
  const userId = await readUserSession();
  if (userId) redirect("/oli/wallet/dashboard");
  return <WalletPage basePath="/oli/wallet" />;
}
