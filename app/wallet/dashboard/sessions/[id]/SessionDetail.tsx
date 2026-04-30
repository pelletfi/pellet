"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

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
  recipient: string;
  amountWei: string;
  txHash: string | null;
  status: string;
  createdAt: string;
};

const EXPLORER = "https://explore.testnet.tempo.xyz";
const COMPLETED = new Set(["signed", "submitted", "confirmed"]);

export function SessionDetail({ session, payments }: { session: Session; payments: Payment[] }) {
  const [revoking, setRevoking] = useState(false);

  const capUsdc = Number(session.spendCapWei) / 1_000_000;
  const usedUsdc = Number(session.spendUsedWei) / 1_000_000;
  const perCallUsdc = Number(session.perCallCapWei) / 1_000_000;
  const remainingUsdc = Math.max(0, capUsdc - usedUsdc);
  const pct = capUsdc > 0 ? Math.min(100, (usedUsdc / capUsdc) * 100) : 0;

  const status = sessionStatus(session);
  const expiresAt = new Date(session.expiresAt);
  const createdAt = new Date(session.createdAt);

  // Cumulative cap-usage chart points. We step up at each completed payment.
  const chartPoints = useMemo(() => buildCumulative(payments, createdAt, expiresAt), [
    payments,
    createdAt,
    expiresAt,
  ]);

  const onRevoke = async () => {
    if (!confirm("Revoke this session? Bearer dies immediately. On-chain key revoke ships in a follow-up.")) return;
    setRevoking(true);
    try {
      const res = await fetch(`/api/wallet/sessions/${session.id}/revoke`, { method: "POST" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(`revoke failed: ${d.error ?? res.statusText}`);
        return;
      }
      window.location.reload();
    } finally {
      setRevoking(false);
    }
  };

  return (
    <div className="sd-page">
      <style>{styles}</style>

      <Link href="/wallet/dashboard" className="sd-back">← all sessions</Link>

      <header className="sd-head">
        <span className="sd-kicker">session · {session.id.slice(0, 8)}…</span>
        <div className="sd-title-row">
          <h1 className="sd-h1">{session.label ?? "Unlabeled agent"}</h1>
          <span className={`sd-pill sd-pill-${status}`}>{status.toUpperCase()}</span>
        </div>
        <p className="sd-summary">
          {plainLanguageSummary(status, remainingUsdc, perCallUsdc, expiresAt, capUsdc, usedUsdc)}
        </p>
      </header>

      {/* Cap usage chart */}
      <section className="sd-card">
        <header className="sd-card-head">
          <h2 className="sd-card-h2">Cap usage</h2>
          <span className="sd-card-meta">
            ${usedUsdc.toFixed(2)} / ${capUsdc.toFixed(2)} · {pct.toFixed(1)}%
          </span>
        </header>
        {usedUsdc > 0 && payments.filter((p) => COMPLETED.has(p.status)).length === 0 && (
          <div className="sd-banner">
            This session reports ${usedUsdc.toFixed(2)} used but has no logged payments — those payments
            predate per-tx logging. The chart shows an inferred lump-sum rather than the true sequence.
          </div>
        )}
        <CapChart
          points={chartPoints}
          cap={capUsdc}
          createdAt={createdAt}
          expiresAt={expiresAt}
          inferredUsdc={
            usedUsdc > 0 && payments.filter((p) => COMPLETED.has(p.status)).length === 0
              ? usedUsdc
              : null
          }
        />
      </section>

      {/* Stats */}
      <div className="sd-grid-stats">
        <Stat label="Per-call cap" value={`$${perCallUsdc.toFixed(4)}`} />
        <Stat label="Remaining" value={`$${remainingUsdc.toFixed(2)}`} />
        <Stat label="Payments" value={payments.length.toString()} />
        <Stat label="Expires" value={formatExpiry(session.expiresAt)} />
      </div>

      {/* Authorize tx + revoke */}
      <section className="sd-card">
        <header className="sd-card-head">
          <h2 className="sd-card-h2">On-chain</h2>
          <span className="sd-card-meta">AccountKeychain.authorizeKey</span>
        </header>
        <div className="sd-onchain">
          <span className="sd-mono sd-dim">authorize tx</span>
          <span>
            {session.authorizeTxHash ? (
              <a className="sd-link" href={`${EXPLORER}/tx/${session.authorizeTxHash}`} target="_blank" rel="noopener noreferrer">
                {session.authorizeTxHash.slice(0, 14)}…{session.authorizeTxHash.slice(-6)} ↗
              </a>
            ) : (
              <span className="sd-mono sd-dim">pending</span>
            )}
          </span>
          <span className="sd-mono sd-dim">created</span>
          <span className="sd-mono">{formatAbsolute(session.createdAt)}</span>
          {status === "active" && (
            <>
              <span className="sd-mono sd-dim">revoke</span>
              <span>
                <button className="sd-btn" onClick={onRevoke} disabled={revoking}>
                  {revoking ? "revoking…" : "revoke session"}
                </button>
              </span>
            </>
          )}
        </div>
      </section>

      {/* Payment history filtered to this session */}
      <section className="sd-card">
        <header className="sd-card-head">
          <h2 className="sd-card-h2">Payments</h2>
          <span className="sd-card-meta">{payments.length} on this session</span>
        </header>
        {payments.length === 0 ? (
          <div className="sd-empty">No payments yet on this session.</div>
        ) : (
          <div>
            <div className="sd-row sd-row-head">
              <span>recipient</span>
              <span>amount</span>
              <span>when</span>
              <span>tx</span>
              <span>status</span>
            </div>
            {[...payments].reverse().map((p) => (
              <div key={p.id} className="sd-row">
                <span className="sd-mono">{p.recipient.slice(0, 10)}…{p.recipient.slice(-6)}</span>
                <span className="sd-mono sd-bright">${(Number(p.amountWei) / 1_000_000).toFixed(4)}</span>
                <span className="sd-mono sd-dim">{formatTimeAgo(p.createdAt)}</span>
                <span>
                  {p.txHash ? (
                    <a className="sd-link" href={`${EXPLORER}/tx/${p.txHash}`} target="_blank" rel="noopener noreferrer">
                      {p.txHash.slice(0, 8)}…
                    </a>
                  ) : (
                    <span className="sd-mono sd-dim">—</span>
                  )}
                </span>
                <span className="sd-pill">{p.status}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="sd-stat">
      <span className="sd-stat-label">{label}</span>
      <span className="sd-stat-value">{value}</span>
    </div>
  );
}

type CumulativePoint = { t: number; usdc: number };

function buildCumulative(payments: Payment[], createdAt: Date, expiresAt: Date): CumulativePoint[] {
  const t0 = createdAt.getTime();
  const tEnd = Math.max(Date.now(), expiresAt.getTime());
  const pts: CumulativePoint[] = [{ t: t0, usdc: 0 }];
  let total = 0;
  for (const p of payments) {
    if (!COMPLETED.has(p.status)) continue;
    total += Number(p.amountWei) / 1_000_000;
    pts.push({ t: new Date(p.createdAt).getTime(), usdc: total });
  }
  // Hold the last value out to the right edge so the step line spans the window.
  pts.push({ t: tEnd, usdc: total });
  return pts;
}

function CapChart({
  points,
  cap,
  createdAt,
  expiresAt,
  inferredUsdc,
}: {
  points: CumulativePoint[];
  cap: number;
  createdAt: Date;
  expiresAt: Date;
  inferredUsdc: number | null;
}) {
  const W = 720;
  const H = 140;
  const padL = 36;
  const padR = 16;
  const padT = 12;
  const padB = 22;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const t0 = createdAt.getTime();
  const tMax = Math.max(Date.now(), expiresAt.getTime());
  const span = Math.max(1, tMax - t0);
  const yMax = Math.max(cap, inferredUsdc ?? 0, ...points.map((p) => p.usdc), 0.0001) * 1.05;

  const x = (t: number) => padL + ((t - t0) / span) * innerW;
  const y = (v: number) => padT + innerH - (v / yMax) * innerH;

  // Build a step path: horizontal then vertical at each point.
  let d = `M ${x(points[0].t)} ${y(points[0].usdc)}`;
  for (let i = 1; i < points.length; i++) {
    const cur = points[i];
    const prev = points[i - 1];
    d += ` L ${x(cur.t)} ${y(prev.usdc)} L ${x(cur.t)} ${y(cur.usdc)}`;
  }

  // Area version (filled below the line) for a blocky cumulative feel.
  const areaD = `${d} L ${x(points[points.length - 1].t)} ${y(0)} L ${x(points[0].t)} ${y(0)} Z`;

  const nowX = Date.now() >= t0 && Date.now() <= tMax ? x(Date.now()) : null;
  const capY = y(cap);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: "block" }} aria-label="cap usage">
      {/* hairline grid */}
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <line
          key={f}
          x1={padL}
          x2={W - padR}
          y1={padT + innerH * (1 - f)}
          y2={padT + innerH * (1 - f)}
          stroke="rgba(255,255,255,0.05)"
          strokeWidth={1}
          strokeDasharray="1 5"
        />
      ))}
      {/* baseline */}
      <line x1={padL} x2={W - padR} y1={padT + innerH} y2={padT + innerH} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
      {/* cap threshold */}
      <line x1={padL} x2={W - padR} y1={capY} y2={capY} stroke="var(--color-accent)" strokeOpacity={0.4} strokeWidth={1} strokeDasharray="3 4" />
      <text x={W - padR} y={capY - 4} textAnchor="end" className="sd-axis">cap ${cap.toFixed(2)}</text>
      {/* inferred lump-sum line for old sessions w/o per-tx logging */}
      {inferredUsdc !== null && (
        <>
          <line
            x1={padL}
            x2={W - padR}
            y1={y(inferredUsdc)}
            y2={y(inferredUsdc)}
            stroke="var(--color-accent)"
            strokeOpacity={0.6}
            strokeWidth={1}
            strokeDasharray="4 4"
          />
          <text x={padL + 4} y={y(inferredUsdc) - 4} className="sd-axis">
            inferred ${inferredUsdc.toFixed(2)}
          </text>
        </>
      )}
      {/* area + step line */}
      <path d={areaD} fill="var(--color-accent)" fillOpacity={0.12} />
      <path d={d} stroke="var(--color-accent)" strokeWidth={1.5} fill="none" />
      {/* now marker */}
      {nowX !== null && (
        <>
          <line x1={nowX} x2={nowX} y1={padT} y2={padT + innerH} stroke="rgba(255,255,255,0.18)" strokeWidth={1} strokeDasharray="2 3" />
          <text x={nowX + 4} y={padT + 9} className="sd-axis">now</text>
        </>
      )}
      {/* x-axis: created · expires */}
      <text x={padL} y={H - 6} className="sd-axis">{shortDate(createdAt)}</text>
      <text x={W - padR} y={H - 6} textAnchor="end" className="sd-axis">{shortDate(expiresAt)}</text>
      {/* y-axis: 0 · cap */}
      <text x={padL - 6} y={padT + innerH + 3} textAnchor="end" className="sd-axis">$0</text>
      <text x={padL - 6} y={padT + 8} textAnchor="end" className="sd-axis">${yMax.toFixed(2)}</text>
    </svg>
  );
}

function sessionStatus(s: Session): "active" | "expired" | "revoked" | "pending" {
  if (s.revokedAt) return "revoked";
  if (new Date(s.expiresAt).getTime() < Date.now()) return "expired";
  if (s.authorizeTxHash) return "active";
  return "pending";
}

function plainLanguageSummary(
  status: string,
  remaining: number,
  perCall: number,
  expiresAt: Date,
  cap: number,
  used: number,
): string {
  if (status === "revoked") return "This session is revoked. The bearer is dead; on-chain key still expires on schedule.";
  if (status === "expired") return `This session expired ${formatTimeAgo(expiresAt.toISOString())}. It spent $${used.toFixed(2)} of its $${cap.toFixed(2)} cap.`;
  if (status === "pending") return "Awaiting on-chain authorization. The agent can't spend until AccountKeychain.authorizeKey lands.";
  return `This session can spend up to $${remaining.toFixed(2)} more (max $${perCall.toFixed(4)} per call) until ${formatAbsolute(expiresAt.toISOString())}.`;
}

function formatExpiry(iso: string): string {
  const d = new Date(iso).getTime();
  const diff = d - Date.now();
  if (diff < 0) return "expired";
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return `${Math.floor(diff / 60_000)}m`;
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function formatTimeAgo(iso: string): string {
  const d = new Date(iso).getTime();
  const ago = Date.now() - d;
  if (ago < 0) return formatExpiry(iso) + " from now";
  const m = Math.floor(ago / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function formatAbsolute(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function shortDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const styles = `
  .sd-page {
    max-width: 1080px;
    margin: 0 auto;
    padding: 32px 32px 96px;
    display: flex;
    flex-direction: column;
    gap: 28px;
  }
  .sd-back {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--color-text-quaternary);
    text-decoration: none;
    letter-spacing: 0.04em;
  }
  .sd-back:hover { color: var(--color-accent); }
  .sd-head { display: flex; flex-direction: column; gap: 10px; }
  .sd-kicker {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--color-text-quaternary);
  }
  .sd-title-row { display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap; }
  .sd-h1 {
    font-family: 'Instrument Serif', Georgia, serif;
    font-size: 40px;
    font-weight: 400;
    letter-spacing: -0.02em;
    margin: 0;
    font-style: italic;
  }
  .sd-summary {
    font-family: var(--font-mono);
    font-size: 13px;
    color: var(--color-text-secondary);
    margin: 4px 0 0;
    max-width: 720px;
  }
  .sd-card {
    border: 1px solid var(--color-border-subtle);
    padding: 20px 24px;
    background: var(--color-bg-base);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .sd-card-head {
    display: flex;
    align-items: baseline;
    gap: 12px;
    padding-bottom: 12px;
    margin-bottom: 4px;
    border-bottom: 1px solid var(--color-border-subtle);
  }
  .sd-card-h2 {
    font-family: 'Instrument Serif', Georgia, serif;
    font-size: 20px;
    font-weight: 400;
    margin: 0;
    flex: 1;
    letter-spacing: -0.01em;
  }
  .sd-card-meta {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-text-quaternary);
    letter-spacing: 0.04em;
  }
  .sd-mono { font-family: var(--font-mono); font-variant-numeric: tabular-nums; font-size: 12px; }
  .sd-bright { color: var(--color-text-primary); }
  .sd-dim { color: var(--color-text-quaternary); font-size: 10px; letter-spacing: 0.04em; text-transform: uppercase; }
  .sd-axis {
    font-family: var(--font-mono);
    font-size: 9px;
    fill: var(--color-text-quaternary);
    letter-spacing: 0.04em;
  }
  .sd-grid-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 1px;
    background: var(--color-border-subtle);
    border: 1px solid var(--color-border-subtle);
  }
  .sd-stat {
    background: var(--color-bg-base);
    padding: 16px 20px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .sd-stat-label {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-text-quaternary);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .sd-stat-value {
    font-family: 'Instrument Serif', Georgia, serif;
    font-style: italic;
    font-size: 24px;
    color: var(--color-text-primary);
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.01em;
  }
  .sd-onchain {
    display: grid;
    grid-template-columns: 100px 1fr;
    row-gap: 10px;
    column-gap: 16px;
    align-items: center;
  }
  .sd-row {
    display: grid;
    grid-template-columns: 1fr auto auto auto auto;
    gap: 12px 16px;
    padding: 12px 0;
    border-bottom: 1px solid var(--color-border-subtle);
    align-items: center;
  }
  .sd-row:last-child { border-bottom: 0; }
  .sd-row-head {
    padding-bottom: 8px;
    font-family: var(--font-mono);
    font-size: 9px;
    color: var(--color-text-quaternary);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    border-bottom: 1px solid var(--color-border-subtle);
  }
  .sd-empty {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--color-text-quaternary);
    padding: 24px 0;
    text-align: center;
  }
  .sd-banner {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--color-text-tertiary);
    background: rgba(154, 154, 154, 0.06);
    border: 1px solid rgba(154, 154, 154, 0.18);
    padding: 10px 14px;
    line-height: 1.5;
  }
  .sd-pill {
    font-family: var(--font-mono);
    font-size: 9px;
    letter-spacing: 0.08em;
    padding: 2px 6px;
    border: 1px solid var(--color-border-subtle);
    color: var(--color-text-tertiary);
  }
  .sd-pill-active { color: var(--color-accent); border-color: var(--color-accent); }
  .sd-pill-revoked { color: var(--color-text-quaternary); border-style: dashed; }
  .sd-pill-expired { color: var(--color-text-quaternary); }
  .sd-link {
    color: var(--color-accent);
    font-family: var(--font-mono);
    font-size: 11px;
    text-decoration: none;
    border-bottom: 1px solid var(--color-border-subtle);
  }
  .sd-link:hover { border-color: var(--color-accent); color: var(--color-text-primary); }
  .sd-btn {
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
  .sd-btn:hover { border-color: var(--color-accent); color: var(--color-text-primary); }
  .sd-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  @media (max-width: 700px) {
    .sd-row { grid-template-columns: 1fr auto; row-gap: 4px; }
    .sd-onchain { grid-template-columns: 1fr; }
  }
`;
