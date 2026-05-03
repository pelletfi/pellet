import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Pellet Wallet — Soon",
  description:
    "Pellet Wallet is currently running in testnet. Mainnet access opens soon.",
};

export default function WalletSoonPage() {
  return (
    <section
      style={{
        minHeight: "calc(100svh - 48px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 24px",
      }}
    >
      <div
        style={{
          width: "min(100%, 520px)",
          display: "flex",
          flexDirection: "column",
          gap: 18,
          textAlign: "center",
        }}
      >
        <p
          style={{
            margin: 0,
            color: "var(--color-text-tertiary)",
            fontSize: 12,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          Wallet soon
        </p>
        <h1
          style={{
            margin: 0,
            color: "var(--color-text-primary)",
            fontSize: "clamp(42px, 7vw, 76px)",
            lineHeight: 0.95,
            fontWeight: 400,
            letterSpacing: 0,
          }}
        >
          Pellet Wallet is currently running in testnet.
        </h1>
        <p
          style={{
            margin: 0,
            color: "var(--color-text-secondary)",
            fontSize: 15,
            lineHeight: 1.6,
          }}
        >
          Mainnet access opens soon. The OLI and docs remain public while the
          wallet surface keeps hardening behind the scenes.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            border: "1px solid var(--color-border-default)",
          }}
        >
          <Link
            href="/oli"
            style={{
              padding: "12px 14px",
              color: "var(--color-text-primary)",
              fontSize: 11,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              textDecoration: "none",
            }}
          >
            OLI
          </Link>
          <Link
            href="/docs"
            style={{
              padding: "12px 14px",
              color: "var(--color-text-primary)",
              fontSize: 11,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              textDecoration: "none",
              borderLeft: "1px solid var(--color-border-default)",
            }}
          >
            Docs
          </Link>
        </div>
      </div>
    </section>
  );
}
