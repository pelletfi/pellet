"use client";

import { useState } from "react";
import Link from "next/link";
import { SpecimenPaymentRow } from "@/components/wallet/SpecimenPaymentRow";
import { TEMPO_EXPLORER_URL } from "@/lib/wallet/tempo-config";

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

const EXPLORER = TEMPO_EXPLORER_URL;

function shortAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}
function shortHash(h: string): string {
  return `${h.slice(0, 6)}…${h.slice(-4)}`;
}
function fmtUsd(n: number, max = 4): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: max })}`;
}
function fmtAbs(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
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
function timeAgo(iso: string): string {
  const ago = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ago / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function sessionState(s: Session): "active" | "pending" | "expired" | "revoked" {
  if (s.revokedAt) return "revoked";
  if (new Date(s.expiresAt).getTime() < Date.now()) return "expired";
  if (!s.authorizeTxHash) return "pending";
  return "active";
}

export function SpecimenSessionDetail({
  session,
  payments,
  basePath = "/wallet",
}: {
  session: Session;
  payments: Payment[];
  basePath?: string;
}) {
  const [revoking, setRevoking] = useState(false);
  const cap = Number(session.spendCapWei) / 1_000_000;
  const used = Number(session.spendUsedWei) / 1_000_000;
  const perCall = Number(session.perCallCapWei) / 1_000_000;
  const pct = cap > 0 ? Math.min(100, (used / cap) * 100) : 0;
  const state = sessionState(session);
  const canRevoke = state === "active" || state === "pending";

  const onRevoke = async () => {
    if (!confirm("Revoke this session? Bearer dies immediately.")) return;
    setRevoking(true);
    try {
      const res = await fetch(`/api/wallet/sessions/${session.id}/revoke`, { method: "POST" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(`revoke failed: ${d.error ?? res.statusText}`);
        return;
      }
      const data = await res.json();

      // Best-effort on-chain revoke via passkey. DB revoke already blocks
      // server-side, so failures here are non-fatal.
      if (data.on_chain) {
        try {
          const { Account, withRelay, tempoActions } = await import("viem/tempo");
          const { createWalletClient, http } = await import("viem");
          const { tempoModerato, tempo: tempoMainnet } = await import("viem/chains");
          const oc = data.on_chain;

          const userAccount = Account.fromWebAuthnP256(
            { id: oc.credential_id, publicKey: oc.public_key_uncompressed },
            { rpId: oc.rp_id },
          );
          const baseChain = oc.chain_id === tempoMainnet.id ? tempoMainnet : tempoModerato;
          const chain = { ...baseChain, feeToken: oc.usdc_e };
          const transport = oc.sponsor_url
            ? withRelay(http(oc.rpc_url), http(oc.sponsor_url), { policy: "sign-only" as const })
            : http(oc.rpc_url);
          const client = createWalletClient({ account: userAccount, chain, transport }).extend(
            tempoActions(),
          );

          await client.accessKey.revoke({
            accessKey: oc.agent_key_address,
            feePayer: true,
            gas: BigInt(5_000_000),
          } as never);
        } catch (e) {
          console.warn("[revoke] on-chain revoke failed (DB already revoked):", e);
        }
      }

      window.location.reload();
    } finally {
      setRevoking(false);
    }
  };

  return (
    <>
      <section className="spec-page-header">
        <div className="spec-page-header-row">
          <h1 className="spec-page-title">
            <span>Session</span>
            <span className="spec-page-title-em">— {session.label ?? session.id.slice(0, 8)}</span>
          </h1>
          <div className="spec-switch" role="group" aria-label="Session actions">
            <Link className="spec-switch-seg" href={`${basePath}/dashboard`}>
              ← DASHBOARD
            </Link>
            {canRevoke && (
              <button
                type="button"
                className="spec-switch-seg"
                onClick={onRevoke}
                disabled={revoking}
              >
                {revoking ? "REVOKING…" : "REVOKE"}
              </button>
            )}
          </div>
        </div>
        <div className="spec-page-subhead">
          <span className="spec-page-subhead-label">ID</span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>{session.id}</span>
          <span className="spec-page-subhead-dot">·</span>
          <span className="spec-page-subhead-label">STATE</span>
          <span>{state.toUpperCase()}</span>
        </div>
      </section>

      <section className="spec-kpi-stack">
        <div className="spec-kpi-card">
          <span className="spec-strip-label">CAP USAGE</span>
          <span className="spec-strip-value spec-strip-value-md">
            {fmtUsd(used)} / {fmtUsd(cap, 2)}
          </span>
          <span className="spec-strip-sub">
            <span>
              {pct.toFixed(1)}% · {payments.length} payment
              {payments.length === 1 ? "" : "s"}
            </span>
            <span className="spec-strip-sub-faint">per-call max {fmtUsd(perCall)}</span>
          </span>
        </div>
        <div className="spec-kpi-card">
          <span className="spec-strip-label">EXPIRES</span>
          <span className="spec-strip-value spec-strip-value-md">{expiryIn(session.expiresAt)}</span>
          <span className="spec-strip-sub">
            <span className="spec-strip-sub-faint">{fmtAbs(session.expiresAt)}</span>
          </span>
        </div>
        <div className="spec-kpi-card">
          <span className="spec-strip-label">ISSUED</span>
          <span className="spec-strip-value spec-strip-value-md">{timeAgo(session.createdAt)}</span>
          <span className="spec-strip-sub">
            <span className="spec-strip-sub-faint">{fmtAbs(session.createdAt)}</span>
          </span>
        </div>
        <div className="spec-kpi-card">
          <span className="spec-strip-label">AUTHORIZE TX</span>
          <span className="spec-strip-value spec-strip-value-md" style={{ fontSize: 18 }}>
            {session.authorizeTxHash ? (
              <a
                href={`${EXPLORER}/tx/${session.authorizeTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ textDecoration: "underline", textUnderlineOffset: 3 }}
              >
                {shortHash(session.authorizeTxHash)}
              </a>
            ) : (
              <span style={{ opacity: 0.5 }}>—</span>
            )}
          </span>
          <span className="spec-strip-sub">
            <span className="spec-strip-sub-faint">on Tempo testnet</span>
          </span>
        </div>
      </section>

      <section className="spec-cols" style={{ gridTemplateColumns: "1fr" }}>
        <div className="spec-col-activity" style={{ flex: 1, borderRight: "none" }}>
          <div className="spec-col-head">
            <span className="spec-col-head-left">PAYMENTS · THIS SESSION</span>
            <span className="spec-col-head-right">
              <span>
                <span style={{ opacity: 0.55 }}>COUNT</span> {payments.length}
              </span>
              <span>
                <span style={{ opacity: 0.55 }}>TOTAL</span> {fmtUsd(used)}
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
              No payments yet on this session.
            </div>
          ) : (
            <>
              <div className="spec-activity-head" style={{ paddingLeft: 24 }}>
                <span className="spec-pay-col-when" style={{ width: 80, flexShrink: 0 }}>WHEN</span>
                <span className="spec-pay-col-tx" style={{ width: 92, flexShrink: 0 }}>TX</span>
                <span style={{ flex: 1, minWidth: 0 }}>RECIPIENT</span>
                <span className="spec-pay-col-amount spec-cell-r" style={{ width: 100, flexShrink: 0 }}>
                  AMOUNT
                </span>
                <span style={{ width: 70, flexShrink: 0 }} className="spec-cell-r">
                  STATUS
                </span>
              </div>
              {payments.map((p) => (
                <SpecimenPaymentRow
                  key={p.id}
                  payment={{ ...p, sessionId: session.id }}
                  basePath={basePath}
                  showSession={false}
                />
              ))}
            </>
          )}
        </div>
      </section>
    </>
  );
}
