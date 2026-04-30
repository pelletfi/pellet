import type { Metadata } from "next";
import { SignInForm } from "./SignInForm";

export const metadata: Metadata = {
  title: "Sign in or create wallet — Pellet",
  description: "Sign in with your passkey, or enroll a fresh passkey to create a new Pellet wallet.",
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
