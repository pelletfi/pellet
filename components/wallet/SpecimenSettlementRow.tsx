"use client";

import { useState } from "react";
import Link from "next/link";

const EXPLORER = "https://explore.tempo.xyz";

const USDCE_ADDR = "0x20c000000000000000000000b9537d11c60e8b50";
const USDT0_ADDR = "0x20c00000000000000000000014f22ca97301eb73";

function tokenSymbol(addr: string | null): string {
  if (!addr) return "—";
  const a = addr.toLowerCase();
  if (a === USDCE_ADDR) return "USDC.e";
  if (a === USDT0_ADDR) return "USDT0";
  return "TOKEN";
}

function shortHash(h: string): string {
  return `${h.slice(0, 6)}…${h.slice(-4)}`;
}

function timeAgoShort(d: Date): string {
  const ago = Date.now() - d.getTime();
  const s = Math.floor(ago / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function fmtAmount(wei: string | null, addr: string | null): string {
  if (!wei) return "—";
  const sym = tokenSymbol(addr);
  const usd = Number(wei) / 1_000_000;
  if (!Number.isFinite(usd)) return `${sym}`;
  if (usd === 0) return `$0 ${sym}`;
  if (Math.abs(usd) >= 1) return `$${usd.toFixed(2)} ${sym}`;
  return `$${usd.toFixed(4)} ${sym}`;
}

export type SettlementEvent = {
  id: number;
  ts: string;
  agentId: string;
  agentLabel: string;
  counterpartyAddress: string | null;
  counterpartyLabel: string | null;
  routedToAddress: string | null;
  routedToLabel: string | null;
  routedFingerprint: string | null;
  kind: string;
  amountWei: string | null;
  tokenAddress: string | null;
  txHash: string;
  sourceBlock: number;
  methodologyVersion: string;
};

export function SpecimenSettlementRow({ ev }: { ev: SettlementEvent }) {
  const [open, setOpen] = useState(false);
  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen((o) => !o);
    }
  };
  const memo = `${ev.kind}:${ev.agentLabel}${
    ev.counterpartyLabel ? ` → ${ev.counterpartyLabel}` : ""
  }`;
  const service = ev.routedToLabel ?? ev.counterpartyLabel ?? "—";
  const tsDate = new Date(ev.ts);

  return (
    <div
      className={`spec-activity-row${open ? " spec-activity-row-open" : ""}`}
      style={{ flexDirection: "column", alignItems: "stretch" }}
    >
      <button
        type="button"
        className="spec-activity-row-btn"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={handleKey}
        aria-expanded={open}
      >
        <span className="spec-activity-row-chevron" aria-hidden="true">
          ›
        </span>
        <span style={{ width: 40, flexShrink: 0, opacity: 0.7 }}>
          {timeAgoShort(tsDate)}
        </span>
        <span style={{ width: 92, flexShrink: 0 }}>
          <span style={{ textDecoration: "underline", textUnderlineOffset: 2 }}>
            {shortHash(ev.txHash)}
          </span>
        </span>
        <span
          style={{
            flex: 1,
            minWidth: 0,
            opacity: 0.85,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {memo}
        </span>
        <span style={{ width: 110, flexShrink: 0 }} className="spec-cell-r">
          {fmtAmount(ev.amountWei, ev.tokenAddress)}
        </span>
        <span
          style={{
            width: 86,
            flexShrink: 0,
            opacity: 0.85,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          className="spec-cell-r"
        >
          {service}
        </span>
        <span
          style={{
            width: 50,
            flexShrink: 0,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "flex-end",
          }}
          className="spec-cell-r"
        >
          <span style={{ letterSpacing: "0.04em" }}>[ OK ]</span>
        </span>
      </button>

      {open && (
        <div className="spec-activity-detail">
          <div className="spec-activity-detail-grid">
            <span className="spec-activity-detail-label">Agent</span>
            <span className="spec-activity-detail-value">
              <Link
                href={`/wallet/agents/${ev.agentId}`}
                className="spec-activity-detail-action"
              >
                {ev.agentLabel}
              </Link>
            </span>

            <span className="spec-activity-detail-label">Counterparty</span>
            <span className="spec-activity-detail-value">
              {ev.counterpartyAddress ? (
                <>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>
                    {ev.counterpartyLabel ?? shortHash(ev.counterpartyAddress)}
                  </span>
                  {ev.counterpartyAddress && (
                    <a
                      href={`${EXPLORER}/address/${ev.counterpartyAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="spec-activity-detail-action"
                    >
                      explorer ↗
                    </a>
                  )}
                </>
              ) : (
                <span style={{ opacity: 0.55 }}>—</span>
              )}
            </span>

            {(ev.routedToAddress || ev.routedFingerprint) && (
              <>
                <span className="spec-activity-detail-label">Routed to</span>
                <span className="spec-activity-detail-value">
                  {ev.routedToAddress ? (
                    <>
                      <span style={{ fontVariantNumeric: "tabular-nums" }}>
                        {ev.routedToLabel ?? shortHash(ev.routedToAddress)}
                      </span>
                      <a
                        href={`${EXPLORER}/address/${ev.routedToAddress}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="spec-activity-detail-action"
                      >
                        explorer ↗
                      </a>
                    </>
                  ) : (
                    <Link
                      href={`/wallet/providers/fp_${ev.routedFingerprint}`}
                      className="spec-activity-detail-action"
                    >
                      fp:{ev.routedFingerprint!.slice(0, 6)}…
                      {ev.routedFingerprint!.slice(-4)}
                    </Link>
                  )}
                </span>
              </>
            )}

            <span className="spec-activity-detail-label">Amount</span>
            <span className="spec-activity-detail-value">
              <span style={{ fontVariantNumeric: "tabular-nums" }}>
                {fmtAmount(ev.amountWei, ev.tokenAddress)}
                {ev.amountWei && ` · ${ev.amountWei} wei`}
              </span>
            </span>

            <span className="spec-activity-detail-label">Tx</span>
            <span className="spec-activity-detail-value">
              <span style={{ fontVariantNumeric: "tabular-nums" }}>
                {ev.txHash}
              </span>
              <a
                href={`${EXPLORER}/tx/${ev.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="spec-activity-detail-action"
              >
                explorer ↗
              </a>
            </span>

            <span className="spec-activity-detail-label">Block</span>
            <span className="spec-activity-detail-value">
              <span style={{ fontVariantNumeric: "tabular-nums" }}>
                {ev.sourceBlock.toLocaleString()}
              </span>
              <a
                href={`${EXPLORER}/block/${ev.sourceBlock}`}
                target="_blank"
                rel="noopener noreferrer"
                className="spec-activity-detail-action"
              >
                explorer ↗
              </a>
            </span>

            <span className="spec-activity-detail-label">Kind</span>
            <span className="spec-activity-detail-value">
              <span style={{ letterSpacing: "0.04em" }}>{ev.kind}</span>
            </span>

            <span className="spec-activity-detail-label">Provenance</span>
            <span className="spec-activity-detail-value">
              <span style={{ opacity: 0.85 }}>
                methodology {ev.methodologyVersion} · source block{" "}
                {ev.sourceBlock.toLocaleString()}
              </span>
            </span>

            <span className="spec-activity-detail-label">When</span>
            <span className="spec-activity-detail-value">
              <span style={{ fontVariantNumeric: "tabular-nums" }}>
                {tsDate.toISOString()}
              </span>
              <span style={{ opacity: 0.6 }}>· {timeAgoShort(tsDate)}</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
