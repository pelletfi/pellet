import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { readUserSession } from "@/lib/wallet/challenge-cookie";
import { SpecimenSignInForm } from "./SpecimenSignInForm";

export const metadata: Metadata = {
  title: "Sign in or create wallet — Pellet",
  description: "Sign in with your passkey, or enroll a fresh passkey to create a new Pellet wallet.",
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function OliWalletSignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const returnTo =
    typeof sp.returnTo === "string" && sp.returnTo.startsWith("/")
      ? sp.returnTo
      : null;

  const userId = await readUserSession();
  if (userId) redirect(returnTo ?? "/wallet/dashboard");
  return <SpecimenSignInForm basePath="/wallet" returnTo={returnTo} />;
}
