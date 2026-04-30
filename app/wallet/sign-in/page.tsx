import type { Metadata } from "next";
import { SignInForm } from "./SignInForm";

export const metadata: Metadata = {
  title: "Sign in — Pellet Wallet",
  description: "Sign in to your Pellet Wallet with the passkey you registered at pairing time.",
};

export const dynamic = "force-dynamic";

export default function WalletSignInPage() {
  return (
    <div
      style={{
        minHeight: "calc(100vh - 48px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <SignInForm />
    </div>
  );
}
