import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Pellet Wallet — open agent wallet on Tempo",
  description:
    "An open agent wallet on Tempo. Public ledger. Self-custody. Every payment recorded for anyone to read.",
  openGraph: {
    title: "Pellet Wallet — open agent wallet on Tempo",
    description:
      "An open agent wallet on Tempo. The ledger is public. The keys are yours.",
    url: "https://pellet.network/wallet",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    site: "@pelletnetwork",
    title: "Pellet Wallet — open agent wallet on Tempo",
    description:
      "An open agent wallet on Tempo. The ledger is public. The keys are yours.",
  },
};

export default function WalletPage() {
  return (
    <div className="wallet-page">
      <style>{`
        .wallet-page {
          padding: 64px 48px 96px;
          max-width: 880px;
          margin: 0 auto;
          color: var(--color-text-primary);
        }
        .wallet-kicker {
          font-family: var(--font-mono);
          font-size: 10px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--color-text-quaternary);
          display: inline-flex;
          align-items: center;
          gap: 10px;
        }
        .wallet-kicker-dot {
          width: 6px;
          height: 6px;
          background: var(--color-accent);
          display: inline-block;
        }
        .wallet-h1 {
          font-family: 'Instrument Serif', Georgia, serif;
          font-size: 72px;
          font-weight: 400;
          letter-spacing: -0.025em;
          line-height: 1;
          margin: 16px 0 24px;
        }
        .wallet-h1-em {
          font-style: italic;
          color: var(--color-accent);
        }
        .wallet-lede {
          font-size: 18px;
          line-height: 1.5;
          color: var(--color-text-secondary);
          margin: 0 0 32px;
          max-width: 60ch;
        }
        .wallet-pitch {
          padding: 24px 28px;
          border-left: 2px solid var(--color-accent);
          background: rgba(122, 150, 178, 0.14);
          font-family: 'Instrument Serif', Georgia, serif;
          font-size: 22px;
          font-style: italic;
          line-height: 1.4;
          color: var(--color-text-primary);
          margin: 0 0 40px;
          letter-spacing: -0.01em;
        }
        .wallet-pitch em {
          color: var(--color-accent);
          font-style: italic;
        }
        .wallet-section {
          margin-top: 48px;
        }
        .wallet-section-head {
          display: flex;
          align-items: baseline;
          gap: 12px;
          padding-bottom: 8px;
          margin-bottom: 16px;
          border-bottom: 1px solid var(--color-border-subtle);
        }
        .wallet-section-n {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--color-accent);
          letter-spacing: 0.06em;
        }
        .wallet-section-h2 {
          font-family: 'Instrument Serif', Georgia, serif;
          font-size: 28px;
          font-weight: 400;
          margin: 0;
          flex: 1;
          letter-spacing: -0.01em;
        }
        .wallet-section-status {
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--color-text-quaternary);
          letter-spacing: 0.04em;
        }
        .wallet-section p {
          color: var(--color-text-secondary);
          font-size: 15px;
          line-height: 1.65;
          margin: 0 0 12px;
        }
        .wallet-cmp {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1px;
          background: var(--color-border-subtle);
          border: 1px solid var(--color-border-subtle);
          margin-top: 16px;
        }
        .wallet-cmp-col {
          background: var(--color-bg-base);
          padding: 20px 24px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .wallet-cmp-name {
          font-family: var(--font-mono);
          font-size: 10px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--color-text-quaternary);
        }
        .wallet-cmp-row {
          font-size: 13px;
          color: var(--color-text-secondary);
          line-height: 1.5;
          padding: 6px 0;
          border-bottom: 1px solid var(--color-border-subtle);
        }
        .wallet-cmp-row:last-child { border-bottom: 0; }
        .wallet-cmp-row strong {
          color: var(--color-text-primary);
          font-weight: 500;
        }
        .wallet-stages {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .wallet-stage {
          display: grid;
          grid-template-columns: 80px 1fr auto;
          gap: 16px;
          padding: 14px 16px;
          border: 1px solid var(--color-border-subtle);
          align-items: baseline;
        }
        .wallet-stage-num {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--color-accent);
          letter-spacing: 0.06em;
        }
        .wallet-stage-name {
          font-size: 14px;
          color: var(--color-text-primary);
        }
        .wallet-stage-name strong {
          font-weight: 500;
        }
        .wallet-stage-name-sub {
          font-size: 12px;
          color: var(--color-text-tertiary);
          margin-top: 2px;
        }
        .wallet-stage-status {
          font-family: var(--font-mono);
          font-size: 9px;
          letter-spacing: 0.1em;
          padding: 4px 8px;
          border: 1px solid;
          white-space: nowrap;
        }
        .wallet-stage-status-shipped {
          color: var(--color-accent);
          border-color: var(--color-accent);
          background: rgba(122, 150, 178, 0.10);
        }
        .wallet-stage-status-building {
          color: var(--color-text-secondary);
          border-color: var(--color-border-subtle);
          border-style: dashed;
        }
        .wallet-stage-status-planned {
          color: var(--color-text-quaternary);
          border-color: var(--color-border-subtle);
          border-style: dotted;
        }
        .wallet-cta {
          margin-top: 56px;
          padding: 32px;
          border: 1px solid var(--color-border-subtle);
          background: var(--color-bg-base);
          text-align: center;
        }
        .wallet-cta-h2 {
          font-family: 'Instrument Serif', Georgia, serif;
          font-size: 28px;
          font-weight: 400;
          margin: 0 0 8px;
          letter-spacing: -0.01em;
        }
        .wallet-cta-sub {
          color: var(--color-text-tertiary);
          font-size: 14px;
          margin: 0 0 20px;
        }
        .wallet-cta-link {
          display: inline-block;
          padding: 12px 24px;
          background: var(--color-accent);
          color: #fff;
          font-family: var(--font-mono);
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          text-decoration: none;
          border: 1px solid var(--color-accent);
          transition: opacity var(--duration-fast) ease;
        }
        .wallet-cta-link:hover { opacity: 0.85; }
        .wallet-cta-secondary {
          display: inline-block;
          margin-left: 16px;
          color: var(--color-text-tertiary);
          font-family: var(--font-mono);
          font-size: 11px;
          letter-spacing: 0.04em;
          text-decoration: none;
          border-bottom: 1px solid var(--color-border-subtle);
        }
        .wallet-foot {
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--color-text-quaternary);
          letter-spacing: 0.04em;
          margin-top: 64px;
          padding-top: 24px;
          border-top: 1px solid var(--color-border-subtle);
          text-align: center;
        }
        .wallet-foot a {
          color: var(--color-accent);
          text-decoration: none;
          border-bottom: 1px solid var(--color-accent);
        }
        @media (max-width: 700px) {
          .wallet-h1 { font-size: 52px; }
          .wallet-cmp { grid-template-columns: 1fr; }
          .wallet-stage { grid-template-columns: 60px 1fr; }
          .wallet-stage-status { grid-column: 1 / -1; justify-self: start; }
        }
      `}</style>

      <header>
        <span className="wallet-kicker">
          <span className="wallet-kicker-dot" aria-hidden="true" />
          Live on Moderato testnet · mainnet pending
        </span>
        <h1 className="wallet-h1">
          Pellet <span className="wallet-h1-em">Wallet.</span>
        </h1>
        <p className="wallet-lede">
          An open agent wallet on Tempo. Agents request payments, the user
          approves, the wallet signs. Every payment auto-records to the
          public OLI ledger — the audit trail is the dashboard.
        </p>

        <p className="wallet-pitch">
          An open agent wallet on Tempo.
          <br />
          The ledger is <em>public</em>. The keys are <em>yours</em>.
        </p>
      </header>

      <section className="wallet-section">
        <header className="wallet-section-head">
          <span className="wallet-section-n">01</span>
          <h2 className="wallet-section-h2">Who it&rsquo;s for</h2>
        </header>
        <p>
          Agents and the people who run them, paying for usage in stables.
          Specifically the population that wants three things together:
          USDC-native settlement (no fiat conversion, no KYC),
          self-custody (keys derived from your passkey, not held by a
          provider), and a public audit trail (every payment recorded
          on-chain and surfaced on OLI).
        </p>
        <p>
          Today that combination isn&rsquo;t served by a wallet — the options
          are roll-your-own EOA wiring or proxying through Tempo&rsquo;s MPP
          gateway. Pellet Wallet fills the gap with the same x402
          challenge/response flow the gateway uses, signed by keys you
          control, and observable from the moment it settles.
        </p>
      </section>

      <section className="wallet-section">
        <header className="wallet-section-head">
          <span className="wallet-section-n">02</span>
          <h2 className="wallet-section-h2">The differentiation</h2>
        </header>
        <div className="wallet-cmp">
          <div className="wallet-cmp-col">
            <span className="wallet-cmp-name">Stripe Link</span>
            <div className="wallet-cmp-row"><strong>Settlement</strong> · card / bank rails</div>
            <div className="wallet-cmp-row"><strong>Custody</strong> · Stripe</div>
            <div className="wallet-cmp-row"><strong>Audit trail</strong> · private to Stripe</div>
            <div className="wallet-cmp-row"><strong>Funding</strong> · fiat (KYC required)</div>
            <div className="wallet-cmp-row"><strong>Trust model</strong> · centralized</div>
            <div className="wallet-cmp-row"><strong>Source</strong> · closed</div>
          </div>
          <div className="wallet-cmp-col">
            <span className="wallet-cmp-name" style={{ color: "var(--color-accent)" }}>Pellet Wallet</span>
            <div className="wallet-cmp-row"><strong>Settlement</strong> · USDC.e / USDT0 on Tempo</div>
            <div className="wallet-cmp-row"><strong>Custody</strong> · passkey-derived, self-custody</div>
            <div className="wallet-cmp-row"><strong>Audit trail</strong> · public, every event on OLI</div>
            <div className="wallet-cmp-row"><strong>Funding</strong> · USDC (no KYC)</div>
            <div className="wallet-cmp-row"><strong>Trust model</strong> · verifiable</div>
            <div className="wallet-cmp-row"><strong>Source</strong> · open</div>
          </div>
        </div>
      </section>

      <section className="wallet-section">
        <header className="wallet-section-head">
          <span className="wallet-section-n">03</span>
          <h2 className="wallet-section-h2">Roadmap</h2>
          <span className="wallet-section-status">staged delivery</span>
        </header>
        <div className="wallet-stages">
          <Stage n="00" name="OLI · the read side" sub="Live observability of every Tempo MPP payment, with per-event provenance and gateway attribution." status="shipped" />
          <Stage n="01" name="Manifesto + waitlist" sub="This page. Plant the flag, gauge interest, document the open trust model." status="shipped" />
          <Stage n="02" name="Skill manifest forward-reference" sub="pellet.network/skill.md advertises the upcoming wallet endpoint to every agent that installs OLI." status="shipped" />
          <Stage n="03" name="Wallet primitive" sub="Passkey-rooted keys via WebAuthn + AccountKeychain T3 authorize, sponsored gas, on-chain cap enforcement. Live on Moderato testnet." status="shipped" />
          <Stage n="04" name="CLI + MCP" sub="@pelletnetwork/cli ships device-code pairing, pellet pay, and an MCP server for Claude Code / Cursor / Anthropic API direct." status="shipped" />
          <Stage n="05" name="Wallet dashboard" sub="Human-facing wallet surface: balance, address copy, active sessions with cap usage, payment history, revoke. Building." status="building" />
          <Stage n="06" name="Mainnet release" sub="Self-hosted sponsor on Presto, second-passkey guardian for recovery, server-side revoke. Pending hardening pass." status="planned" />
        </div>
      </section>

      <section className="wallet-cta">
        <h2 className="wallet-cta-h2">Want it when it ships?</h2>
        <p className="wallet-cta-sub">
          Open an issue with subject <code>Wallet · interest</code> on the
          repo to register. We&rsquo;ll prioritize early signers for the
          sandbox.
        </p>
        <a
          href="https://github.com/pelletnetwork/pellet/issues/new?title=Wallet+%C2%B7+interest&body=Following+along+on+Pellet+Wallet+development.+Optionally%3A+how+you%E2%80%99d+use+it%2C+what+rails+you%E2%80%99d+want+covered."
          target="_blank"
          rel="noopener noreferrer"
          className="wallet-cta-link"
        >
          Register on GitHub ↗
        </a>
        <Link href="/oli" className="wallet-cta-secondary">
          or read the live OLI ledger →
        </Link>
      </section>

      <p className="wallet-foot">
        Built in the open at{" "}
        <a href="https://github.com/pelletnetwork/pellet" target="_blank" rel="noopener noreferrer">
          pelletnetwork/pellet
        </a>
        . Read the methodology at <a href="/oli/methodology">/oli/methodology</a>.
      </p>
    </div>
  );
}

function Stage({
  n,
  name,
  sub,
  status,
}: {
  n: string;
  name: string;
  sub: string;
  status: "shipped" | "building" | "planned";
}) {
  const labels = { shipped: "SHIPPED", building: "BUILDING", planned: "PLANNED" };
  return (
    <div className="wallet-stage">
      <span className="wallet-stage-num">{n}</span>
      <div>
        <div className="wallet-stage-name">
          <strong>{name}</strong>
        </div>
        <div className="wallet-stage-name-sub">{sub}</div>
      </div>
      <span className={`wallet-stage-status wallet-stage-status-${status}`}>{labels[status]}</span>
    </div>
  );
}
