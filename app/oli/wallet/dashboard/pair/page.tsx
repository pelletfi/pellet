import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { readUserSession } from "@/lib/wallet/challenge-cookie";
import { DeviceApproval } from "@/app/wallet/device/DeviceApproval";

export const metadata: Metadata = {
  title: "Pair Agent — Pellet Wallet",
  description:
    "Approve an agent's spend authority. Enter the 6-digit code your CLI returned, choose a cap, and sign with your passkey.",
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// User-side half of the device-code pairing flow. CLI runs `pellet auth
// start` → server returns a 6-digit code → user lands here, enters the
// code, signs with passkey to approve → backend mints the bearer + the
// CLI's poll picks it up.
//
// The DeviceApproval component owns the actual flow (auth, cap select,
// browser-side signing of AccountKeychain.authorizeKey). This page just
// wraps it in the specimen shell so the surface stays consistent.
export default async function PairAgentPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const userId = await readUserSession();
  if (!userId) redirect("/oli/wallet/sign-in");

  const { code } = await searchParams;

  return (
    <>
      <section className="spec-page-header">
        <div className="spec-page-header-row">
          <h1 className="spec-page-title">
            <span>Wallet</span>
            <span className="spec-page-title-em">— pair agent</span>
          </h1>
          <Link href="/oli/wallet/dashboard" className="spec-switch">
            <span className="spec-switch-seg">← DASHBOARD</span>
          </Link>
        </div>
        <div className="spec-page-subhead">
          <span>
            Run <code style={{ fontFamily: "var(--font-mono)" }}>pellet auth start</code> from the CLI to get a 3-word code, then enter it below.
          </span>
        </div>
      </section>

      <section style={{ margin: "0 32px", padding: "32px 0 48px" }}>
        <DeviceApproval initialCode={code ?? ""} />
      </section>
    </>
  );
}
