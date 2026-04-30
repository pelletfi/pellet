"use client";

import { useState } from "react";
import Link from "next/link";

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

const EXPLORER = "https://explore.testnet.tempo.xyz";

export function Dashboard({
  user,
  balances,
  chart,
  sessions,
  payments,
}: {
  user: User;
  balances: Balance[];
  chart: ChartPoint[];
  sessions: Session[];
  payments: Payment[];
}) {
  const [copied, setCopied] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

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
          gap: 32px;
        }
        /* Type pattern (locked across wallet pages): h1 italic + stat-value
         * italic; h2 upright. h1 size varies by surface importance; h2 fixed
         * at 22, stat-value fixed at 28. */
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
          border: 1px solid var(--color-border-subtle);
          border-radius: 8px;
          padding: 24px 28px;
          background: var(--color-bg-base);
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .dash-card-head {
          display: flex;
          align-items: baseline;
          gap: 12px;
          padding-bottom: 12px;
          margin-bottom: 4px;
          border-bottom: 1px solid var(--color-border-subtle);
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
          gap: 12px;
          font-family: var(--font-mono);
          font-size: 13px;
          color: var(--color-text-secondary);
          flex-wrap: wrap;
        }
        .dash-btn {
          padding: 8px 14px;
          background: transparent;
          border: 1px solid var(--color-border-subtle);
          color: var(--color-text-secondary);
          font-family: var(--font-mono);
          font-size: 11px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          cursor: pointer;
          transition: border-color var(--duration-fast) ease;
        }
        .dash-btn:hover { border-color: var(--color-accent); color: var(--color-text-primary); }
        .dash-btn-primary {
          background: var(--color-accent);
          border-color: var(--color-accent);
          color: #fff;
        }
        .dash-btn-primary:hover { opacity: 0.9; color: #fff; }
        .dash-empty {
          font-family: var(--font-mono);
          font-size: 12px;
          color: var(--color-text-quaternary);
          padding: 24px 0;
          text-align: center;
        }
        .dash-grid-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 1px;
          background: var(--color-border-subtle);
          border: 1px solid var(--color-border-subtle);
          border-radius: 8px;
          overflow: hidden;
        }
        .dash-stat {
          background: var(--color-bg-base);
          padding: 18px 22px;
          display: flex;
          flex-direction: column;
          gap: 6px;
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
          border-bottom: 1px solid var(--color-border-subtle);
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
          border-bottom: 1px solid var(--color-border-subtle);
        }
        .dash-cap-bar {
          width: 110px;
          height: 4px;
          background: rgba(255,255,255,0.06);
          position: relative;
        }
        .dash-cap-bar-fill {
          height: 100%;
          background: var(--color-accent);
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
          padding: 2px 6px;
          border: 1px solid var(--color-border-subtle);
          color: var(--color-text-tertiary);
        }
        .dash-pill-active {
          color: var(--color-accent);
          border-color: var(--color-accent);
        }
        .dash-pill-revoked {
          color: var(--color-text-quaternary);
          border-style: dashed;
        }
        .dash-pill-expired {
          color: var(--color-text-quaternary);
        }
        .dash-link {
          color: var(--color-accent);
          font-family: var(--font-mono);
          font-size: 11px;
          text-decoration: none;
          border-bottom: 1px solid var(--color-border-subtle);
        }
        .dash-link:hover { border-color: var(--color-accent); color: var(--color-text-primary); }
        .dash-addr-full { word-break: break-all; }
        .dash-addr-trunc { display: none; }
        @media (max-width: 700px) {
          .dashpage { padding: 32px 20px 80px; }
          .dash-h1 { font-size: 36px; }
          .dash-addr-full { display: none; }
          .dash-addr-trunc { display: inline; }
          .dash-row {
            grid-template-columns: 1fr auto;
            row-gap: 4px;
          }
          /* Hide the 5-col header row when data rows collapse to 2 cols —
           * label + status pill is enough context on mobile. */
          .dash-row-head { display: none; }
        }
      `}</style>

      <header style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16 }}>
          <span className="dash-kicker">Pellet Wallet</span>
          <Link href="/wallet/dashboard/settings" className="dash-kicker" style={{ textDecoration: "none" }}>
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
                    href={`/wallet/dashboard/sessions/${s.id}`}
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
                    href={`/wallet/dashboard/sessions/${p.sessionId}`}
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

      <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--color-text-quaternary)", textAlign: "center", marginTop: 12 }}>
        Testnet · all funds are play money. Mainnet pending sponsor + recovery.{" "}
        <Link href="/wallet" style={{ color: "var(--color-accent)" }}>roadmap →</Link>
      </p>
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
          stroke="rgba(255,255,255,0.08)"
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
