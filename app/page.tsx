import type { Metadata } from "next";
import Link from "next/link";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Pellet — Coming Soon",
  description:
    "Pellet is an agent wallet interface on Tempo. Currently running in testnet.",
  openGraph: {
    title: "Pellet — Coming Soon",
    description:
      "Agent wallets, identity cards, scoped permissions, and session keys. Currently testnet.",
    url: "https://pellet.network",
    siteName: "Pellet",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pellet — Coming Soon",
    description:
      "Agent wallets, identity cards, scoped permissions, and session keys. Currently testnet.",
    site: "@pelletnetwork",
  },
};

export default function LandingPage() {
  return (
    <>
      <style>{`
        html:has(.landing-soon),
        body:has(.landing-soon) {
          background: #bcbcbc;
          color: #111111;
          color-scheme: light;
        }

        body:has(.landing-soon) {
          --color-bg-base: #bcbcbc;
          --color-bg-subtle: #b5b5b5;
          --color-bg-muted: #adadad;
          --color-bg-emphasis: #a5a5a5;
          --color-border-subtle: rgba(17, 17, 17, 0.26);
          --color-border-default: rgba(17, 17, 17, 0.48);
          --color-border-emphasis: #111111;
          --color-text-primary: #111111;
          --color-text-secondary: rgba(17, 17, 17, 0.72);
          --color-text-tertiary: rgba(17, 17, 17, 0.58);
          --color-text-quaternary: rgba(17, 17, 17, 0.46);
        }

        body:has(.landing-soon) main {
          background: #bcbcbc;
          animation: none;
        }
      `}</style>
      <section className={`${styles.landing} landing-soon`} aria-label="Pellet coming soon">
        <div className={styles.shell}>
          <div className={styles.videoFrame}>
            <video
              className={styles.video}
              src="/pellet-landing.mp4"
              autoPlay
              loop
              muted
              playsInline
              preload="auto"
              aria-label="Pellet wallet agent identity card preview"
            />
          </div>
          <p className={styles.footnote}>
            Pellet Wallet is currently running in testnet. Mainnet access opens soon.
          </p>
          <nav className={styles.links} aria-label="Pellet links">
            <Link href="/oli">OLI</Link>
            <Link href="/docs">Docs</Link>
          </nav>
        </div>
      </section>
    </>
  );
}
