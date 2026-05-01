import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Pellet Wallet",
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// `/oli/wallet` is just an alias for the dashboard. The dashboard handles
// auth itself (renders if signed in, redirects to /sign-in otherwise) so
// there's exactly one source of truth for the wallet UX inside /oli.
// The marketing-landing explainer still lives at `/wallet` for direct
// visitors who land there from outside the OLI surface.
export default function OliWalletRedirect() {
  redirect("/oli/wallet/dashboard");
}
