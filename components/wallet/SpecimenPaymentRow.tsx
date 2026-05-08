"use client";

import { useState } from "react";
import Link from "next/link";

const EXPLORER = "https://explore.tempo.xyz";

export type PaymentRowData = {
  id: string;
  sessionId: string;
  recipient: string;
  amountWei: string;
  txHash: string | null;
  status: string;
  createdAt: string;
};

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

function statusBracket(status: string): string {
  const s = status.toLowerCase();
  if (s === "signed" || s === "submitted" || s === "confirmed") return "OK";
  if (s === "failed" || s === "rejected") return "ERR";
  if (s === "pending") return "···";
  return s.toUpperCase();
}

function statusLabel(status: string): string {
  const s = status.toLowerCase();
  if (s === "confirmed") return "settled";
  if (s === "submitted") return "sent";
  if (s === "signed") return "signed";
  if (s === "failed" || s === "rejected") return "failed";
  if (s === "pending") return "pending";
  return status;
}

function statusKind(status: string): "ok" | "pending" | "err" {
  const s = status.toLowerCase();
  if (s === "failed" || s === "rejected") return "err";
  if (s === "pending") return "pending";
  return "ok";
}

/**
 * Click-to-expand drawer row for a wallet payment (`wallet_spend_log`).
 * Used on /wallet/dashboard's signed-payments table and on the
 * /wallet/dashboard/sessions/[id] session-detail page so both surfaces
 * share the same drawer fields and `[ OK ]`-bracket status pills.
 *
 * `showSession` defaults to true (dashboard view, where each row's session
 * link is useful) and false on the session-detail page (every row is the
 * same session anyway, so the column would be wasted).
 */
export function SpecimenPaymentRow({
  payment: p,
  basePath,
  showSession = true,
}: {
  payment: PaymentRowData;
  basePath: string;
  showSession?: boolean;
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
        <span className="spec-pay-col-when" style={{ width: 80, flexShrink: 0, opacity: 0.7 }}>
          {timeAgo(p.createdAt)}
        </span>
        <span className="spec-pay-col-tx" style={{ width: 92, flexShrink: 0 }}>
          {p.txHash ? (
            <span style={{ textDecoration: "underline", textUnderlineOffset: 2 }}>
              {shortHash(p.txHash)}
            </span>
          ) : (
            <span style={{ opacity: 0.5 }}>—</span>
          )}
        </span>
        <span className="spec-payment-summary">
          <span className="spec-payment-title">Payment to {shortAddr(p.recipient)}</span>
          <span className="spec-payment-sub">
            policy check · session signed
          </span>
        </span>
        {showSession && (
          <span
            className="spec-pay-col-session"
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
        )}
        <span className="spec-pay-col-amount spec-cell-r" style={{ width: 100, flexShrink: 0 }}>
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
          <span className={`spec-status-pill spec-status-pill-${statusKind(p.status)}`}>
            [ {statusLabel(p.status)} ]
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

            <span className="spec-activity-detail-label">Policy</span>
            <span className="spec-activity-detail-value">
              <span>Session key signed after wallet-side cap checks.</span>
            </span>

            <span className="spec-activity-detail-label">Status</span>
            <span className="spec-activity-detail-value">
              <span className={`spec-status-pill spec-status-pill-${statusKind(p.status)}`}>
                [ {statusLabel(p.status)} ]
              </span>
              <span style={{ opacity: 0.6 }}>{statusBracket(p.status)}</span>
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
      {copied ? "copied" : "copy"}
    </button>
  );
}
