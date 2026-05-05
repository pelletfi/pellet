"use client";

import { useState } from "react";
import Link from "next/link";
import { ChatDrawer } from "./ChatDrawer";
import { TEMPO_EXPLORER_URL, defaultTempoChainId, TEMPO_CHAIN_IDS } from "@/lib/wallet/tempo-config";

type User = {
  id: string;
  managedAddress: string;
  displayName: string | null;
};

type Balance = {
  symbol: string;
  address: string;
  display: string;
  rawWei: string;
};

type ChartPoint = { label: string; spentUsdc: number };

type Session = {
  id: string;
  label: string | null;
  spendCapWei: string;
  spendUsedWei: string;
  perCallCapWei: string;
  expiresAt: string;
  revokedAt: string | null;
  authorizeTxHash: string | null;
  createdAt: string;
};

type Payment = {
  id: string;
  sessionId: string;
  recipient: string;
  amountWei: string;
  txHash: string | null;
  status: string;
  createdAt: string;
};

type Subscription = {
  plan: string;
  expiresAt: string;
} | null;

const EXPLORER = TEMPO_EXPLORER_URL;
const IS_MAINNET = defaultTempoChainId() === TEMPO_CHAIN_IDS.PRESTO_MAINNET;

export function Dashboard({
  user,
  balances,
  chart,
  sessions,
  payments,
  subscription = null as Subscription,
  basePath = "/wallet",
}: {
  user: User;
  balances: Balance[];
  chart: ChartPoint[];
  sessions: Session[];
  payments: Payment[];
  subscription?: Subscription;
  /**
   * URL prefix for internal navigation. "/wallet" for the canonical surface,
   * "/oli/wallet" when the wallet is embedded inside the OLI shell so the
   * user stays in OLI while clicking around.
   */
  basePath?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [swapFrom, setSwapFrom] = useState<string | null>(null);
  const [swapTo, setSwapTo] = useState("");
  const [swapAmt, setSwapAmt] = useState("");
  const [swapQuote, setSwapQuote] = useState<string | null>(null);
  const [swapQuoteSymbol, setSwapQuoteSymbol] = useState("");
  const [swapping, setSwapping] = useState(false);

  const swappableTokens = balances.filter((b) =>
    ["pathUSD", "USDC.e", "USDT0"].includes(b.symbol),
  );

  const onRevoke = async (sessionId: string) => {
    if (!confirm("Revoke this session? Bearer dies immediately. On-chain key revoke ships in a follow-up.")) return;
    setRevoking(sessionId);
    try {
      const res = await fetch(`/api/wallet/sessions/${sessionId}/revoke`, { method: "POST" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(`revoke failed: ${d.error ?? res.statusText}`);
        return;
      }
      window.location.reload();
    } finally {
      setRevoking(null);
    }
  };

  // Total balance across all tokens (display only — assumes 1:1 USD pegs)
  const totalUsd = balances.reduce((acc, b) => acc + Number(b.display), 0);

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(user.managedAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  const totalUsedUsdc = payments.reduce(
    (acc, p) => acc + (p.status === "submitted" || p.status === "confirmed" || p.status === "signed" ? Number(p.amountWei) / 1_000_000 : 0),
    0,
  );

  return (
    <div className="dashpage">
      <style>{`
        .dashpage {
          max-width: 1080px;
          margin: 0 auto;
          padding: 48px 32px 96px;
          display: flex;
          flex-direction: column;
          gap: 28px;
        }
        .dash-h1 {
          font-family: 'Instrument Serif', Georgia, serif;
          font-size: 48px;
          font-weight: 400;
          letter-spacing: -0.02em;
          margin: 0;
        }
        .dash-kicker {
          font-family: var(--font-mono);
          font-size: 10px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--color-text-quaternary);
        }
        .dash-card {
          border: none;
          border-radius: 24px;
          padding: 24px 28px;
          background: var(--color-bg-base);
          display: flex;
          flex-direction: column;
          gap: 12px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.06), 0 16px 56px rgba(0,0,0,0.1);
        }
        @media (prefers-color-scheme: dark) {
          .dash-card { box-shadow: 0 6px 20px rgba(0,0,0,0.3), 0 20px 64px rgba(0,0,0,0.35); }
        }
        .dash-card-head {
          display: flex;
          align-items: baseline;
          gap: 12px;
          padding-bottom: 12px;
          margin-bottom: 4px;
          border-bottom: none;
        }
        .dash-card-h2 {
          font-family: 'Instrument Serif', Georgia, serif;
          font-size: 22px;
          font-weight: 400;
          margin: 0;
          flex: 1;
          letter-spacing: -0.01em;
        }
        .dash-card-meta {
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--color-text-quaternary);
          letter-spacing: 0.04em;
        }
        .dash-mono {
          font-family: var(--font-mono);
          font-variant-numeric: tabular-nums;
        }
        .dash-addr {
          display: flex;
          align-items: center;
          gap: 10px;
          font-family: var(--font-mono);
          font-size: 13px;
          color: var(--color-text-secondary);
          flex-wrap: wrap;
        }
        .dash-btn {
          padding: 8px 14px;
          background: transparent;
          border: none;
          border-radius: 12px;
          color: var(--color-text-secondary);
          font-family: var(--font-mono);
          font-size: 11px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease;
          box-shadow: 0 1px 4px rgba(0,0,0,0.06), 0 4px 14px rgba(0,0,0,0.06);
        }
        .dash-btn:hover { background: rgba(0,0,0,0.04); color: var(--color-text-primary); }
        .dash-btn-primary {
          background: var(--color-text-primary);
          color: var(--color-bg-base);
          box-shadow: 0 2px 8px rgba(0,0,0,0.12), 0 8px 24px rgba(0,0,0,0.1);
        }
        .dash-btn-primary:hover { opacity: 0.9; color: var(--color-bg-base); }
        .dash-empty {
          font-family: var(--font-mono);
          font-size: 12px;
          color: var(--color-text-quaternary);
          padding: 24px 0;
          text-align: center;
        }
        .dash-notice {
          padding: 16px 20px;
          border-radius: 16px;
          background: color-mix(in srgb, var(--color-text-primary) 4%, transparent);
          display: flex;
          align-items: flex-start;
          gap: 12px;
          font-family: var(--font-mono);
          font-size: 11px;
          line-height: 1.5;
          color: var(--color-text-tertiary);
        }
        .dash-notice-icon {
          flex-shrink: 0;
          font-size: 14px;
          line-height: 1.2;
          opacity: 0.5;
        }
        .dash-notice a {
          color: var(--color-text-secondary);
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        .dash-grid-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 12px;
          background: transparent;
          border: none;
          border-radius: 0;
          overflow: visible;
        }
        .dash-stat {
          background: var(--color-bg-base);
          padding: 20px 24px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          border-radius: 20px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.06), 0 16px 56px rgba(0,0,0,0.1);
        }
        @media (prefers-color-scheme: dark) {
          .dash-stat { box-shadow: 0 6px 20px rgba(0,0,0,0.3), 0 20px 64px rgba(0,0,0,0.35); }
        }
        .dash-stat-label {
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--color-text-quaternary);
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        .dash-stat-value {
          font-family: 'Instrument Serif', Georgia, serif;
          font-style: italic;
          font-size: 28px;
          color: var(--color-text-primary);
          letter-spacing: -0.01em;
          font-variant-numeric: tabular-nums;
        }
        .dash-row {
          display: grid;
          grid-template-columns: 1fr auto auto auto auto;
          gap: 12px 16px;
          padding: 12px 0;
          border-bottom: 1px solid color-mix(in srgb, var(--color-text-primary) 4%, transparent);
          align-items: center;
        }
        .dash-row:last-child { border-bottom: 0; }
        .dash-row-head {
          padding-bottom: 8px;
          font-family: var(--font-mono);
          font-size: 9px;
          color: var(--color-text-quaternary);
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .dash-cap-bar {
          width: 110px;
          height: 4px;
          background: color-mix(in srgb, var(--color-text-primary) 8%, transparent);
          border-radius: 2px;
          position: relative;
          overflow: hidden;
        }
        .dash-cap-bar-fill {
          height: 100%;
          border-radius: 2px;
          background: var(--color-text-primary);
          transition: width 0.6s ease;
        }
        .dash-cap-bar-text {
          font-family: var(--font-mono);
          font-size: 10px;
          color: var(--color-text-tertiary);
          font-variant-numeric: tabular-nums;
          margin-top: 4px;
        }
        .dash-pill {
          font-family: var(--font-mono);
          font-size: 9px;
          letter-spacing: 0.08em;
          padding: 3px 8px;
          border: none;
          border-radius: 6px;
          color: var(--color-text-tertiary);
          background: color-mix(in srgb, var(--color-text-primary) 6%, transparent);
        }
        .dash-pill-active {
          color: var(--color-text-primary);
          background: color-mix(in srgb, var(--color-text-primary) 10%, transparent);
        }
        .dash-pill-revoked {
          color: var(--color-text-quaternary);
        }
        .dash-pill-expired {
          color: var(--color-text-quaternary);
        }
        .dash-link {
          color: var(--color-text-primary);
          font-family: var(--font-mono);
          font-size: 11px;
          text-decoration: none;
          opacity: 0.6;
          transition: opacity 0.15s ease;
        }
        .dash-link:hover { opacity: 1; }
        .dash-addr-full { word-break: break-all; }
        .dash-addr-trunc { display: none; }
        @media (max-width: 700px) {
          .dashpage { padding: 32px 16px 80px; gap: 20px; }
          .dash-h1 { font-size: 36px; }
          .dash-card { padding: 20px 20px; border-radius: 20px; }
          .dash-stat { padding: 16px 18px; border-radius: 16px; }
          .dash-addr-full { display: none; }
          .dash-addr-trunc { display: inline; }
          .dash-row {
            grid-template-columns: 1fr auto;
            row-gap: 4px;
          }
          .dash-row-head { display: none; }
          .dash-grid-stats { gap: 10px; }
        }
        .dash-balance-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 0;
          border-bottom: 1px solid var(--color-border-subtle);
        }
        .dash-balance-row:last-child { border-bottom: none; }
        .dash-balance-symbol {
          font-family: var(--font-mono);
          font-size: 14px;
          flex: 1;
        }
        .dash-balance-amount {
          font-family: var(--font-mono);
          font-size: 14px;
          font-variant-numeric: tabular-nums;
          color: var(--color-text-primary);
        }
        .dash-swap-icon {
          padding: 4px 8px;
          border-radius: 8px;
          border: 1px solid var(--color-border-subtle);
          background: transparent;
          cursor: pointer;
          font-size: 14px;
          color: var(--color-text-tertiary);
          transition: background 0.15s;
        }
        .dash-swap-icon:hover {
          background: var(--color-bg-subtle);
          color: var(--color-text-primary);
        }
        .dash-swap-panel {
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 16px 0 4px;
          border-top: 1px solid var(--color-border-subtle);
          margin-top: 4px;
        }
        .dash-select {
          padding: 10px 14px;
          border-radius: 12px;
          border: 1px solid var(--color-border-subtle);
          background: var(--color-bg-subtle);
          font-size: 14px;
          font-family: var(--font-mono);
          outline: none;
          color: var(--color-text-primary);
        }
        .dash-swap-input {
          padding: 10px 14px;
          border-radius: 12px;
          border: 1px solid var(--color-border-subtle);
          background: var(--color-bg-subtle);
          font-size: 14px;
          font-family: var(--font-mono);
          outline: none;
        }
      `}</style>

      <header style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16 }}>
          <span className="dash-kicker">Pellet Wallet</span>
          <Link href={`${basePath}/dashboard/settings`} className="dash-kicker" style={{ textDecoration: "none" }}>
            settings →
          </Link>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 16, flexWrap: "wrap" }}>
          <h1 className="dash-h1" style={{ fontStyle: "italic" }}>
            ${totalUsd.toFixed(2)}
          </h1>
          {balances.length > 0 && (
            <span className="dash-mono" style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>
              {balances.map((b, i) => (
                <span key={b.address}>
                  {i > 0 && <span style={{ color: "var(--color-text-quaternary)", margin: "0 6px" }}>·</span>}
                  {b.symbol} ${b.display}
                </span>
              ))}
            </span>
          )}
        </div>
        <div className="dash-addr" style={{ marginTop: 8 }}>
          <span className="dash-kicker">addr</span>
          <code className="dash-addr-full" title={user.managedAddress}>{user.managedAddress}</code>
          <code className="dash-addr-trunc" title={user.managedAddress}>
            {user.managedAddress.slice(0, 10)}…{user.managedAddress.slice(-6)}
          </code>
          <button className="dash-btn" onClick={copyAddress}>
            {copied ? "copied ✓" : "copy"}
          </button>
          <a
            className="dash-btn"
            href={`${EXPLORER}/address/${user.managedAddress}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            explorer ↗
          </a>
          <a
            className="dash-btn dash-btn-primary"
            href={`${EXPLORER}/address/${user.managedAddress}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            deposit
          </a>
        </div>
      </header>

      {IS_MAINNET && (
        <div className="dash-notice">
          <span className="dash-notice-icon">!</span>
          <span>
            Your wallet is secured by a single passkey on this device.
            If your device supports iCloud Keychain or Google Password Manager, your passkey syncs automatically.
            Otherwise, losing this device means losing access to your funds.{" "}
            <Link href={`${basePath}/dashboard/settings`}>review passkey →</Link>
          </span>
        </div>
      )}

      {/* 7-day spend chart */}
      <SpendChart chart={chart} />

      {/* Quick stats */}
      <div className="dash-grid-stats">
        <div className="dash-stat">
          <span className="dash-stat-label">Active sessions</span>
          <span className="dash-stat-value">{sessions.filter(activeSession).length}</span>
        </div>
        <div className="dash-stat">
          <span className="dash-stat-label">Payments · all-time</span>
          <span className="dash-stat-value">{payments.length}</span>
        </div>
        <div className="dash-stat">
          <span className="dash-stat-label">Spent · all-time</span>
          <span className="dash-stat-value">${totalUsedUsdc.toFixed(2)}</span>
        </div>
      </div>

      {/* Plan */}
        <div className="dash-card">
          <div className="dash-card-head">
            <h2 className="dash-card-h2">Plan</h2>
            <span className="dash-card-meta">
              {subscription ? "PRO" : "FREE"}
            </span>
          </div>
          {subscription ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span className="dash-mono" style={{ fontSize: 14 }}>
                Pro — expires {new Date(subscription.expiresAt).toLocaleDateString()}
              </span>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
                Free tier — 1 agent, 1% fee
              </span>
              <button
                className="dash-btn dash-btn-primary"
                onClick={async () => {
                  if (!confirm("Upgrade to Pro for 5 USDC/month?\n\nUnlimited agents, 0.25% fee.")) return;
                  const res = await fetch("/api/wallet/subscribe", { method: "POST" });
                  const data = await res.json();
                  if (!res.ok) {
                    alert(`Upgrade failed: ${data.error}`);
                    return;
                  }
                  window.location.reload();
                }}
              >
                Upgrade to Pro — $5/mo
              </button>
            </div>
          )}
        </div>

        {/* Balances */}
        <div className="dash-card">
          <div className="dash-card-head">
            <h2 className="dash-card-h2">Balances</h2>
          </div>
          {balances.map((b) => (
            <div key={b.symbol}>
              <div className="dash-balance-row">
                <span className="dash-balance-symbol">{b.symbol}</span>
                <span className="dash-balance-amount">${b.display}</span>
                {swappableTokens.length >= 2 && swappableTokens.some((t) => t.symbol === b.symbol) && (
                  <button
                    className="dash-swap-icon"
                    title={`Swap ${b.symbol}`}
                    onClick={() => {
                      if (swapFrom === b.symbol) {
                        setSwapFrom(null);
                        return;
                      }
                      setSwapFrom(b.symbol);
                      const defaultTo = swappableTokens.find((t) => t.symbol !== b.symbol);
                      setSwapTo(defaultTo?.symbol ?? "");
                      setSwapAmt("");
                      setSwapQuote(null);
                    }}
                  >
                    ↔
                  </button>
                )}
              </div>
              {swapFrom === b.symbol && (
                <div className="dash-swap-panel">
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span className="dash-mono" style={{ fontSize: 13, color: "var(--color-text-tertiary)", minWidth: 32 }}>To</span>
                    <select
                      className="dash-select"
                      value={swapTo}
                      onChange={(e) => { setSwapTo(e.target.value); setSwapQuote(null); }}
                      style={{ flex: 1 }}
                    >
                      {swappableTokens.filter((t) => t.symbol !== b.symbol).map((t) => (
                        <option key={t.symbol} value={t.symbol}>{t.symbol}</option>
                      ))}
                    </select>
                  </div>
                  <input
                    className="dash-swap-input"
                    type="text"
                    inputMode="decimal"
                    placeholder={`Amount in ${b.symbol}`}
                    value={swapAmt}
                    onChange={(e) => { setSwapAmt(e.target.value); setSwapQuote(null); }}
                  />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      className="dash-btn"
                      disabled={!swapAmt}
                      onClick={async () => {
                        const tokenIn = swappableTokens.find((t) => t.symbol === b.symbol);
                        const tokenOut = swappableTokens.find((t) => t.symbol === swapTo);
                        if (!tokenIn || !tokenOut) return;
                        const res = await fetch("/api/wallet/swap", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ token_in: tokenIn.address, token_out: tokenOut.address, amount: swapAmt, quote_only: true }),
                        });
                        const data = await res.json();
                        if (data.ok) { setSwapQuote(data.amount_out); setSwapQuoteSymbol(swapTo); }
                        else alert(data.error);
                      }}
                    >
                      Quote
                    </button>
                    <button
                      className="dash-btn dash-btn-primary"
                      disabled={!swapQuote || swapping}
                      onClick={async () => {
                        const tokenIn = swappableTokens.find((t) => t.symbol === b.symbol);
                        const tokenOut = swappableTokens.find((t) => t.symbol === swapTo);
                        if (!tokenIn || !tokenOut) return;
                        setSwapping(true);
                        try {
                          const res = await fetch("/api/wallet/swap", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ token_in: tokenIn.address, token_out: tokenOut.address, amount: swapAmt }),
                          });
                          const data = await res.json();
                          if (!res.ok) { alert(`Swap failed: ${data.error}`); return; }
                          setSwapFrom(null);
                          setSwapAmt("");
                          setSwapQuote(null);
                          window.location.reload();
                        } finally {
                          setSwapping(false);
                        }
                      }}
                    >
                      {swapping ? "Swapping…" : "Swap"}
                    </button>
                  </div>
                  {swapQuote && (
                    <span className="dash-mono" style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
                      ≈ {swapQuote} {swapQuoteSymbol}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

      {/* Active agent sessions */}
      <section className="dash-card">
        <header className="dash-card-head">
          <h2 className="dash-card-h2">Agent sessions</h2>
          <span className="dash-card-meta">on-chain authorized · cap-bounded</span>
        </header>
        {sessions.length === 0 ? (
          <div className="dash-empty">
            No agents paired yet. Run <code>pellet auth start</code> to pair one.
          </div>
        ) : (
          <div>
            <div className="dash-row dash-row-head">
              <span>label · agent</span>
              <span>used / cap</span>
              <span>expires</span>
              <span>tx</span>
              <span>status</span>
            </div>
            {sessions.map((s) => {
              const cap = Number(s.spendCapWei) / 1_000_000;
              const used = Number(s.spendUsedWei) / 1_000_000;
              const pct = cap > 0 ? Math.min(100, (used / cap) * 100) : 0;
              return (
                <div key={s.id} className="dash-row">
                  <Link
                    href={`${basePath}/dashboard/sessions/${s.id}`}
                    style={{ textDecoration: "none", color: "inherit" }}
                  >
                    <div className="dash-mono" style={{ fontSize: 13, color: "var(--color-text-primary)" }}>
                      {s.label ?? "—"}
                    </div>
                    <div className="dash-mono" style={{ fontSize: 10, color: "var(--color-text-quaternary)" }}>
                      session · {s.id.slice(0, 8)}… <span style={{ color: "var(--color-accent)" }}>↗</span>
                    </div>
                  </Link>
                  <div>
                    <div className="dash-cap-bar">
                      <div className="dash-cap-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="dash-cap-bar-text">
                      ${used.toFixed(2)} / ${cap.toFixed(2)}
                    </div>
                  </div>
                  <span className="dash-mono" style={{ fontSize: 10, color: "var(--color-text-tertiary)" }}>
                    {formatExpiry(s.expiresAt)}
                  </span>
                  <span>
                    {s.authorizeTxHash ? (
                      <a
                        className="dash-link"
                        href={`${EXPLORER}/tx/${s.authorizeTxHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {s.authorizeTxHash.slice(0, 8)}…
                      </a>
                    ) : (
                      <span className="dash-mono" style={{ fontSize: 10, color: "var(--color-text-quaternary)" }}>
                        pending
                      </span>
                    )}
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className={`dash-pill ${pillClass(s)}`}>{pillLabel(s)}</span>
                    {!s.revokedAt && new Date(s.expiresAt).getTime() > Date.now() && (
                      <button
                        className="dash-btn"
                        style={{ padding: "8px 12px", fontSize: 10, minHeight: 32 }}
                        onClick={() => onRevoke(s.id)}
                        disabled={revoking === s.id}
                      >
                        {revoking === s.id ? "…" : "revoke"}
                      </button>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Activity */}
      <section className="dash-card">
        <header className="dash-card-head">
          <h2 className="dash-card-h2">Activity</h2>
          <span className="dash-card-meta">
            {payments.length === 0
              ? "no payments yet"
              : payments.length >= 50
                ? "latest 50 payments"
                : `${payments.length} recent payment${payments.length === 1 ? "" : "s"}`}
          </span>
        </header>
        {payments.length === 0 ? (
          <div className="dash-empty">No payments yet. Once an authorized agent calls pellet pay, they show up here.</div>
        ) : (
          <div>
            <div className="dash-row dash-row-head">
              <span>recipient</span>
              <span>amount</span>
              <span>when</span>
              <span>tx</span>
              <span>status</span>
            </div>
            {payments.map((p) => (
              <div key={p.id} className="dash-row">
                <div>
                  <div className="dash-mono" style={{ fontSize: 12 }}>
                    {p.recipient.slice(0, 10)}…{p.recipient.slice(-6)}
                  </div>
                  <Link
                    href={`${basePath}/dashboard/sessions/${p.sessionId}`}
                    className="dash-mono"
                    style={{ fontSize: 10, color: "var(--color-text-quaternary)", textDecoration: "none" }}
                  >
                    session {p.sessionId.slice(0, 8)}… <span style={{ color: "var(--color-accent)" }}>↗</span>
                  </Link>
                </div>
                <span className="dash-mono" style={{ fontSize: 12, color: "var(--color-text-primary)" }}>
                  ${(Number(p.amountWei) / 1_000_000).toFixed(4)}
                </span>
                <span className="dash-mono" style={{ fontSize: 10, color: "var(--color-text-tertiary)" }}>
                  {formatTimeAgo(p.createdAt)}
                </span>
                <span>
                  {p.txHash ? (
                    <a
                      className="dash-link"
                      href={`${EXPLORER}/tx/${p.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {p.txHash.slice(0, 8)}…
                    </a>
                  ) : (
                    <span className="dash-mono" style={{ fontSize: 10, color: "var(--color-text-quaternary)" }}>—</span>
                  )}
                </span>
                <span className="dash-pill">{p.status}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--color-text-quaternary)", textAlign: "center", marginTop: 12, paddingBottom: 48 }}>
        {IS_MAINNET
          ? "Mainnet · self-custody · every payment is an on-chain transaction."
          : "Testnet · all funds are play money."
        }
      </p>

      <ChatDrawer />
    </div>
  );
}

function activeSession(s: Session): boolean {
  if (s.revokedAt) return false;
  if (new Date(s.expiresAt).getTime() < Date.now()) return false;
  return s.authorizeTxHash != null;
}

function pillClass(s: Session): string {
  if (s.revokedAt) return "dash-pill-revoked";
  if (new Date(s.expiresAt).getTime() < Date.now()) return "dash-pill-expired";
  if (s.authorizeTxHash) return "dash-pill-active";
  return "";
}

function pillLabel(s: Session): string {
  if (s.revokedAt) return "REVOKED";
  if (new Date(s.expiresAt).getTime() < Date.now()) return "EXPIRED";
  if (s.authorizeTxHash) return "ACTIVE";
  return "PENDING";
}

function formatExpiry(iso: string): string {
  const d = new Date(iso).getTime();
  const now = Date.now();
  const diff = d - now;
  if (diff < 0) return "expired";
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return `${Math.floor(diff / 60_000)}m`;
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function formatTimeAgo(iso: string): string {
  const d = new Date(iso).getTime();
  const ago = Date.now() - d;
  const m = Math.floor(ago / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function SpendChart({ chart }: { chart: ChartPoint[] }) {
  const total = chart.reduce((acc, p) => acc + p.spentUsdc, 0);
  const maxVal = Math.max(...chart.map((p) => p.spentUsdc), 0.01);
  const W = 720;
  const H = 96;
  const padT = 4;
  const padB = 18;
  const innerH = H - padT - padB;
  const barW = (W - 8) / chart.length - 8;

  return (
    <section className="dash-card">
      <header className="dash-card-head">
        <h2 className="dash-card-h2">Last 7 days</h2>
        <span className="dash-card-meta">
          {total > 0 ? `total spent · $${total.toFixed(2)}` : "no payments yet"}
        </span>
      </header>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        style={{ display: "block" }}
        role="img"
        aria-label="7-day spend"
      >
        <title>Spending by day, last 7 days</title>
        <line
          x1={0}
          x2={W}
          y1={H - padB}
          y2={H - padB}
          stroke="color-mix(in srgb, var(--color-text-primary) 6%, transparent)"
          strokeWidth={1}
        />
        {chart.map((p, i) => {
          const h = total === 0 ? 0 : (p.spentUsdc / maxVal) * innerH;
          const x = 4 + i * (barW + 8);
          const y = padT + innerH - h;
          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={h}
                fill={p.spentUsdc > 0 ? "var(--color-accent)" : "rgba(255,255,255,0.05)"}
              />
              <text
                x={x + barW / 2}
                y={H - 4}
                textAnchor="middle"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  fill: "var(--color-text-quaternary)",
                  letterSpacing: "0.04em",
                }}
              >
                {p.label}
              </text>
            </g>
          );
        })}
      </svg>
    </section>
  );
}
