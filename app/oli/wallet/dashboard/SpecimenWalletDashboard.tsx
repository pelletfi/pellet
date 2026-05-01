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

function shortAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function shortHash(h: string): string {
  return `${h.slice(0, 6)}…${h.slice(-4)}`;
}

function fmtUsd(n: number, max = 2): string {
  if (!Number.isFinite(n)) return "$0";
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: max })}`;
}

function fmtUsdCompact(n: number): string {
  if (n === 0) return "$0";
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return fmtUsd(n);
}

function timeAgo(iso: string): string {
  const ago = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ago / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function expiryIn(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff < 0) return "expired";
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

function sessionState(s: Session): "active" | "pending" | "expired" | "revoked" {
  if (s.revokedAt) return "revoked";
  if (new Date(s.expiresAt).getTime() < Date.now()) return "expired";
  if (!s.authorizeTxHash) return "pending";
  return "active";
}

export function SpecimenWalletDashboard({
  user,
  balances,
  sessions,
  payments,
  basePath = "/oli/wallet",
}: {
  user: User;
  balances: Balance[];
  chart: ChartPoint[];
  sessions: Session[];
  payments: Payment[];
  basePath?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const totalUsd = balances.reduce((acc, b) => acc + Number(b.display), 0);
  const usdce = balances.find((b) => b.symbol === "USDC.e");
  const usdt0 = balances.find((b) => b.symbol === "USDT0" || b.symbol === "pathUSD");

  const now = Date.now();
  const ms30d = 30 * 24 * 3600 * 1000;
  const settled = payments.filter((p) =>
    p.status === "signed" || p.status === "submitted" || p.status === "confirmed",
  );
  const sent30d = settled
    .filter((p) => now - new Date(p.createdAt).getTime() <= ms30d)
    .reduce((acc, p) => acc + Number(p.amountWei) / 1_000_000, 0);
  const sent30dCount = settled.filter(
    (p) => now - new Date(p.createdAt).getTime() <= ms30d,
  ).length;
  const sent30dAvg = sent30dCount > 0 ? sent30d / sent30dCount : 0;

  const activeSessions = sessions.filter((s) => sessionState(s) === "active");
  const pendingSessions = sessions.filter((s) => sessionState(s) === "pending");

  const passkeyLabel = user.displayName?.trim() || "iCloud Keychain";
  const pairedDevices: string[] = user.displayName?.trim()
    ? [user.displayName.trim()]
    : ["this device"];
  const pairedCount = pairedDevices.length;

  const ms7d = 7 * 24 * 3600 * 1000;
  const signedPayments7d = payments.filter(
    (p) => now - new Date(p.createdAt).getTime() <= ms7d,
  );

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(user.managedAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  };

  const onSignOut = async () => {
    if (!confirm("Sign out of this browser?\n\nAgent sessions and on-chain keys stay live — this just clears your browser session.")) {
      return;
    }
    setSigningOut(true);
    try {
      await fetch("/api/wallet/me/sign-out", { method: "POST" });
      window.location.href = `${basePath}/sign-in`;
    } catch {
      setSigningOut(false);
    }
  };

  const onRevoke = async (sessionId: string) => {
    if (!confirm("Revoke this session? Bearer dies immediately.")) return;
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

  return (
    <>
      <section className="spec-page-header">
        <div className="spec-page-header-row">
          <h1 className="spec-page-title">
            <span>02</span>
            <span>Wallet</span>
          </h1>
          <div className="spec-switch" role="group" aria-label="Wallet actions">
            <button
              type="button"
              className="spec-switch-seg"
              onClick={() =>
                alert(
                  "Pair agent — coming soon.\n\nFor now, run `pellet auth start` from the CLI; the pending approval will surface in the right rail when ready.",
                )
              }
              title="Approve an agent's spend authority — coming soon"
            >
              PAIR AGENT
            </button>
            <button
              type="button"
              className="spec-switch-seg"
              onClick={() =>
                alert(
                  "Wallet export — coming soon.\n\nYour passkey is your only required backup; raw key export will be available later.",
                )
              }
              title="Export wallet credentials — coming soon"
            >
              EXPORT
            </button>
            <button
              type="button"
              className="spec-switch-seg spec-switch-seg-active"
              onClick={onSignOut}
              disabled={signingOut}
              title="Sign out of this browser — agent sessions stay live"
            >
              {signingOut ? "SIGNING OUT…" : "SIGN OUT"}
            </button>
          </div>
        </div>
        <div className="spec-page-subhead">
          <span className="spec-page-subhead-label">ADDR</span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>{user.managedAddress}</span>
          <button
            type="button"
            onClick={copyAddress}
            aria-label={copied ? "Address copied" : "Copy wallet address"}
            title={copied ? "Copied" : "Copy address"}
            className="spec-copy-btn"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 13 13"
              aria-hidden="true"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
            >
              <rect x="3.5" y="3.5" width="7" height="7" />
              <path d="M2 8.5 L2 2 L8.5 2" />
            </svg>
          </button>
          <span className="spec-page-subhead-dot">·</span>
          <span className="spec-page-subhead-label">PASSKEY</span>
          <span>{passkeyLabel}</span>
          <span className="spec-page-subhead-dot">·</span>
          <span className="spec-page-subhead-label">PAIRED</span>
          <span>
            {pairedCount} {pairedCount === 1 ? "device" : "devices"}
          </span>
        </div>
      </section>

      <section className="spec-strip">
        <div className="spec-strip-cell" style={{ flex: "1.4 1 0" }}>
          <span className="spec-strip-label">TOTAL BALANCE</span>
          <span className="spec-strip-value spec-strip-value-lg">{fmtUsd(totalUsd)}</span>
          <span
            className="spec-strip-sub"
            style={{ flexDirection: "row", gap: 18, flexWrap: "wrap" }}
          >
            {usdce && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span className="spec-legend-square spec-legend-square-outline" />
                <span>USDC.e {fmtUsd(Number(usdce.display))}</span>
              </span>
            )}
            {usdt0 && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span className="spec-legend-square spec-legend-square-filled" />
                <span>{usdt0.symbol} {fmtUsd(Number(usdt0.display))}</span>
              </span>
            )}
            {balances.length === 0 && (
              <span className="spec-strip-sub-faint">no balances yet</span>
            )}
          </span>
        </div>
        <div className="spec-strip-cell">
          <span className="spec-strip-label">SENT · 30D</span>
          <span className="spec-strip-value spec-strip-value-md">{fmtUsdCompact(sent30d)}</span>
          <span className="spec-strip-sub">
            <span>{sent30dCount} settlement{sent30dCount === 1 ? "" : "s"}</span>
            <span className="spec-strip-sub-faint">
              {sent30dCount > 0 ? `avg ${fmtUsd(sent30dAvg, 4)}` : "—"}
            </span>
          </span>
        </div>
        <div className="spec-strip-cell">
          <span className="spec-strip-label">SESSION KEYS</span>
          <span className="spec-strip-value spec-strip-value-md">
            {activeSessions.length} / {sessions.length || 0}
          </span>
          <span className="spec-strip-sub">
            <span>active out of issued</span>
            {pendingSessions.length > 0 && (
              <span className="spec-strip-sub-faint">
                {pendingSessions.length} pending
              </span>
            )}
          </span>
        </div>
        <div className="spec-strip-cell">
          <span className="spec-strip-label">PAIRED DEVICES</span>
          <span className="spec-strip-value spec-strip-value-md">
            {pairedCount}
          </span>
          <span className="spec-strip-sub">
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {pairedDevices.join(" · ")}
            </span>
          </span>
        </div>
      </section>

      <section className="spec-cols">
        <ActivityColumn payments={signedPayments7d} basePath={basePath} />
        <RightRail
          sessions={sessions}
          basePath={basePath}
          revoking={revoking}
          onRevoke={onRevoke}
        />
      </section>
    </>
  );
}

function ActivityColumn({
  payments,
  basePath,
}: {
  payments: Payment[];
  basePath: string;
}) {
  return (
    <div className="spec-col-activity">
      <div className="spec-col-head">
        <span className="spec-col-head-left">SIGNED PAYMENTS · 7D</span>
        <span className="spec-col-head-right">
          <span>
            <span style={{ opacity: 0.55 }}>COUNT</span> {payments.length}
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span className="spec-legend-square spec-legend-square-filled" />
            <span>STREAMING</span>
          </span>
        </span>
      </div>

      {payments.length === 0 ? (
        <div
          style={{
            padding: "32px 0",
            textAlign: "center",
            opacity: 0.6,
            fontSize: 12,
          }}
        >
          No signed payments in the last 7 days. Once an authorized agent calls{" "}
          <code style={{ opacity: 0.8 }}>pellet pay</code>, they show up here.
        </div>
      ) : (
        <>
          <div className="spec-activity-head">
            <span style={{ width: 80, flexShrink: 0 }}>WHEN</span>
            <span style={{ width: 92, flexShrink: 0 }}>TX</span>
            <span style={{ flex: 1, minWidth: 0 }}>MEMO / SERVICE</span>
            <span style={{ width: 86, flexShrink: 0 }} className="spec-cell-r">
              SESSION
            </span>
            <span style={{ width: 100, flexShrink: 0 }} className="spec-cell-r">
              AMOUNT
            </span>
            <span style={{ width: 70, flexShrink: 0 }} className="spec-cell-r">
              STATUS
            </span>
          </div>
          {payments.map((p) => (
            <ActivityRow key={p.id} payment={p} basePath={basePath} />
          ))}
        </>
      )}
    </div>
  );
}

function statusBracket(status: string): string {
  const s = status.toLowerCase();
  if (s === "signed" || s === "submitted" || s === "confirmed") return "OK";
  if (s === "failed" || s === "rejected") return "ERR";
  if (s === "pending") return "···";
  return s.toUpperCase();
}

function ActivityRow({
  payment: p,
  basePath,
}: {
  payment: Payment;
  basePath: string;
}) {
  const [open, setOpen] = useState(false);
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen((o) => !o);
    }
  };
  const amountUsdc = Number(p.amountWei) / 1_000_000;
  return (
    <div
      className={`spec-activity-row${open ? " spec-activity-row-open" : ""}`}
      style={{ flexDirection: "column", alignItems: "stretch" }}
    >
      <button
        type="button"
        className="spec-activity-row-btn"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={handleKeyDown}
        aria-expanded={open}
      >
        <span className="spec-activity-row-chevron" aria-hidden="true">
          ›
        </span>
        <span style={{ width: 80, flexShrink: 0, opacity: 0.7 }}>
          {timeAgo(p.createdAt)}
        </span>
        <span style={{ width: 92, flexShrink: 0 }}>
          {p.txHash ? (
            <span style={{ textDecoration: "underline", textUnderlineOffset: 2 }}>
              {shortHash(p.txHash)}
            </span>
          ) : (
            <span style={{ opacity: 0.5 }}>—</span>
          )}
        </span>
        <span
          style={{
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {shortAddr(p.recipient)}
        </span>
        <span
          style={{
            width: 86,
            flexShrink: 0,
            opacity: 0.7,
            textAlign: "right",
            textDecoration: "underline",
            textUnderlineOffset: 2,
          }}
        >
          {p.sessionId.slice(0, 6)}…
        </span>
        <span style={{ width: 100, flexShrink: 0 }} className="spec-cell-r">
          {fmtUsd(amountUsdc, 4)}
        </span>
        <span
          style={{
            width: 70,
            flexShrink: 0,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "flex-end",
          }}
          className="spec-cell-r"
        >
          <span style={{ letterSpacing: "0.04em" }}>
            [ {statusBracket(p.status)} ]
          </span>
        </span>
      </button>

      {open && (
        <div className="spec-activity-detail">
          <div className="spec-activity-detail-grid">
            <span className="spec-activity-detail-label">Tx</span>
            <span className="spec-activity-detail-value">
              {p.txHash ? (
                <>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>
                    {p.txHash}
                  </span>
                  <CopyAction text={p.txHash} />
                  <a
                    href={`${EXPLORER}/tx/${p.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="spec-activity-detail-action"
                    title="View on explorer"
                  >
                    explorer ↗
                  </a>
                </>
              ) : (
                <span style={{ opacity: 0.55 }}>not yet broadcast</span>
              )}
            </span>

            <span className="spec-activity-detail-label">Recipient</span>
            <span className="spec-activity-detail-value">
              <span style={{ fontVariantNumeric: "tabular-nums" }}>
                {p.recipient}
              </span>
              <CopyAction text={p.recipient} />
              <a
                href={`${EXPLORER}/address/${p.recipient}`}
                target="_blank"
                rel="noopener noreferrer"
                className="spec-activity-detail-action"
                title="View on explorer"
              >
                explorer ↗
              </a>
            </span>

            <span className="spec-activity-detail-label">Session</span>
            <span className="spec-activity-detail-value">
              <Link
                href={`${basePath}/dashboard/sessions/${p.sessionId}`}
                className="spec-activity-detail-action"
              >
                {p.sessionId}
              </Link>
              <CopyAction text={p.sessionId} />
            </span>

            <span className="spec-activity-detail-label">Amount</span>
            <span className="spec-activity-detail-value">
              <span style={{ fontVariantNumeric: "tabular-nums" }}>
                {fmtUsd(amountUsdc, 6)} · {p.amountWei} wei
              </span>
            </span>

            <span className="spec-activity-detail-label">Status</span>
            <span className="spec-activity-detail-value">
              <span style={{ letterSpacing: "0.04em" }}>
                [ {statusBracket(p.status)} ]
              </span>
              <span style={{ opacity: 0.6 }}>{p.status}</span>
            </span>

            <span className="spec-activity-detail-label">When</span>
            <span className="spec-activity-detail-value">
              <span style={{ fontVariantNumeric: "tabular-nums" }}>
                {new Date(p.createdAt).toISOString()}
              </span>
              <span style={{ opacity: 0.6 }}>· {timeAgo(p.createdAt)}</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function CopyAction({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="spec-activity-detail-action"
      onClick={async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch {
          /* noop */
        }
      }}
      title="Copy to clipboard"
    >
      {copied ? "copied" : "[copy]"}
    </button>
  );
}

function RightRail({
  sessions,
  basePath,
  revoking,
  onRevoke,
}: {
  sessions: Session[];
  basePath: string;
  revoking: string | null;
  onRevoke: (id: string) => void;
}) {
  const active = sessions.filter((s) => sessionState(s) === "active");
  const pending = sessions.filter((s) => sessionState(s) === "pending");
  const visibleActive = active.slice(0, 4);
  return (
    <div className="spec-col-rail">
      <div className="spec-col-head">
        <span className="spec-col-head-left">ACTIVE SESSION KEYS</span>
        <span className="spec-col-head-right">
          <span>
            <span style={{ opacity: 0.55 }}>QUOTA</span>{" "}
            {active.length} / {sessions.length}
          </span>
        </span>
      </div>

      {visibleActive.length === 0 ? (
        <div
          style={{ padding: "20px 0", opacity: 0.6, fontSize: 12, textAlign: "center" }}
        >
          No active sessions. Run <code>pellet auth start</code> to pair an agent.
        </div>
      ) : (
        visibleActive.map((s) => {
          const cap = Number(s.spendCapWei) / 1_000_000;
          const used = Number(s.spendUsedWei) / 1_000_000;
          const perCall = Number(s.perCallCapWei) / 1_000_000;
          return (
            <div key={s.id} className="spec-session-card">
              <div className="spec-session-top">
                <Link
                  href={`${basePath}/dashboard/sessions/${s.id}`}
                  style={{ fontSize: 13 }}
                >
                  {s.label ?? s.id.slice(0, 8)}
                </Link>
                <span className="spec-pill">[ ACTIVE ]</span>
              </div>
              <div className="spec-meta-grid">
                <span className="spec-meta-label">issued</span>
                <span>{timeAgo(s.createdAt)}</span>
                <span className="spec-meta-label">expires</span>
                <span>{expiryIn(s.expiresAt)}</span>
                <span className="spec-meta-label">scope</span>
                <span>≤ {fmtUsd(perCall, 4)} / call</span>
                <span className="spec-meta-label">used</span>
                <span>
                  {fmtUsd(used, 4)} / {fmtUsd(cap)}
                </span>
              </div>
              <div className="spec-pending-actions" style={{ alignSelf: "flex-end" }}>
                <button
                  type="button"
                  className="spec-pending-btn"
                  onClick={() => onRevoke(s.id)}
                  disabled={revoking === s.id}
                >
                  {revoking === s.id ? "REVOKING…" : "REVOKE"}
                </button>
              </div>
            </div>
          );
        })
      )}

      <Link
        href={`${basePath}/dashboard/sessions`}
        className="spec-issue-new"
        style={{ marginTop: 0 }}
      >
        <span className="spec-keycap" aria-hidden="true">
          +
        </span>
        <span>ISSUE NEW SESSION</span>
      </Link>

      {pending.length > 0 && (
        <div className="spec-pending-card">
          <div className="spec-pending-top">
            <span style={{ letterSpacing: "0.08em", fontSize: 11, opacity: 0.7 }}>
              PENDING APPROVAL
            </span>
            <span className="spec-pill">[ {pending.length} ]</span>
          </div>
          {pending.slice(0, 1).map((s) => {
            const cap = Number(s.spendCapWei) / 1_000_000;
            const perCall = Number(s.perCallCapWei) / 1_000_000;
            return (
              <div
                key={s.id}
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                <div className="spec-session-top">
                  <Link
                    href={`${basePath}/dashboard/sessions/${s.id}`}
                    style={{ fontSize: 13 }}
                  >
                    {s.label ?? s.id.slice(0, 8)}
                  </Link>
                </div>
                <div className="spec-meta-grid">
                  <span className="spec-meta-label">issued</span>
                  <span>{timeAgo(s.createdAt)}</span>
                  <span className="spec-meta-label">expires</span>
                  <span>{expiryIn(s.expiresAt)}</span>
                  <span className="spec-meta-label">scope</span>
                  <span>≤ {fmtUsd(perCall, 4)} / call</span>
                  <span className="spec-meta-label">cap</span>
                  <span>{fmtUsd(cap)}</span>
                </div>
                <div className="spec-pending-actions">
                  <button
                    type="button"
                    className="spec-pending-btn"
                    onClick={() => onRevoke(s.id)}
                    disabled={revoking === s.id}
                  >
                    {revoking === s.id ? "REJECTING…" : "REJECT"}
                  </button>
                  <button
                    type="button"
                    className="spec-pending-btn spec-pending-btn-primary"
                    onClick={() =>
                      alert("On-chain approval is automatic once the authorize tx confirms.")
                    }
                  >
                    APPROVE
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
