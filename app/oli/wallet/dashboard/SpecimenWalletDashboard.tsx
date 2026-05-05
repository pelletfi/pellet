"use client";

import { useState } from "react";
import Link from "next/link";
import { AgentIdentityCard } from "@/components/oli/AgentIdentityCard";
import { SpecimenPaymentRow } from "@/components/oli/SpecimenPaymentRow";
import { WalletTabs } from "@/components/oli/WalletTabs";
import { ChatDrawer } from "@/app/wallet/dashboard/ChatDrawer";
import { ChatRailCard } from "@/app/wallet/dashboard/ChatRailCard";

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

type Agent = {
  id: string;
  clientId: string;
  clientName: string;
  clientType: string;
  scopes: string[];
  tokenState: string;
  lastSeenAt: string;
  webhookEnabled: boolean;
  sessionId: string | null;
};

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

function pct(used: number, cap: number): number {
  if (!Number.isFinite(used) || !Number.isFinite(cap) || cap <= 0) return 0;
  return Math.max(0, Math.min(100, (used / cap) * 100));
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

type ChatMsg = {
  id: string;
  connectionId: string | null;
  clientId: string | null;
  sessionId: string | null;
  sender: "agent" | "user" | "system";
  kind: string;
  content: string;
  intentId: string | null;
  metadata: unknown;
  ts: string;
};

function SendModal({
  from,
  onClose,
}: {
  from: Balance;
  onClose: () => void;
}) {
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function doSend() {
    if (!to || !amount) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/wallet/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token: from.address,
          to,
          amount,
        }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error ?? "Send failed"); return; }
      onClose();
      window.location.reload();
    } catch {
      setError("Network error");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="spec-swap-backdrop" onClick={onClose}>
      <div className="spec-swap-modal" onClick={(e) => e.stopPropagation()}>
        <div className="spec-swap-header">
          <span className="spec-swap-title">SEND</span>
          <button type="button" className="spec-swap-close" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
              <path d="M3 3l8 8M11 3l-8 8" />
            </svg>
          </button>
        </div>

        <div className="spec-swap-body">
          <label className="spec-swap-field-label">Token</label>
          <div className="spec-swap-amount-row">
            <span className="spec-swap-input-symbol">{from.symbol}</span>
          </div>
          <div className="spec-swap-available">
            {Number(from.display).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })} {from.symbol} available
          </div>

          <label className="spec-swap-field-label">Amount</label>
          <div className="spec-swap-amount-row">
            <input
              type="text"
              inputMode="decimal"
              className="spec-swap-input"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
            />
          </div>

          <label className="spec-swap-field-label">Recipient address</label>
          <div className="spec-swap-amount-row">
            <input
              type="text"
              className="spec-swap-input"
              placeholder="0x…"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              spellCheck={false}
              autoComplete="off"
            />
          </div>

          <div className="spec-swap-fee">
            <span>Fee</span>
            <span>{"< $0.01"}</span>
          </div>

          {error && <div className="spec-swap-error">{error}</div>}
        </div>

        <div className="spec-swap-actions">
          <button type="button" className="spec-swap-btn" onClick={onClose}>
            CANCEL
          </button>
          <button
            type="button"
            className="spec-swap-btn"
            onClick={doSend}
            disabled={sending || !amount || !to}
          >
            {sending ? "SENDING…" : "SEND"}
          </button>
        </div>
      </div>
    </div>
  );
}

const TOKEN_ICONS: Record<string, string> = {
  "usdc.e": "/tokens/usdc.png",
  "usdc": "/tokens/usdc.png",
  "usdt0": "/tokens/usdt.png",
  "usdt": "/tokens/usdt.png",
  "pathusd": "/tokens/pathusd.png",
};

function TokenIcon({ symbol }: { symbol: string }) {
  const src = TOKEN_ICONS[symbol.toLowerCase()];
  if (src) {
    return (
      <img
        className="spec-holding-icon"
        src={src}
        alt={symbol}
        width={20}
        height={20}
      />
    );
  }
  return (
    <span className="spec-holding-icon" style={{ background: "var(--line)", fontSize: 10, color: "var(--fg)" }} aria-hidden="true">
      {symbol.charAt(0)}
    </span>
  );
}

function SwapModal({
  from,
  balances,
  onClose,
}: {
  from: Balance;
  balances: Balance[];
  onClose: () => void;
}) {
  const others = balances.filter((b) => b.address !== from.address);
  const [toToken, setToToken] = useState(others[0]?.symbol ?? "");
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<string | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toBalance = others.find((b) => b.symbol === toToken);

  async function doQuote() {
    if (!amount || !toBalance) return;
    setQuoting(true);
    setError(null);
    setQuote(null);
    try {
      const res = await fetch("/api/wallet/swap", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token_in: from.address,
          token_out: toBalance.address,
          amount,
          quote_only: true,
        }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error ?? "Quote failed"); return; }
      setQuote(d.amount_out);
    } catch {
      setError("Network error");
    } finally {
      setQuoting(false);
    }
  }

  async function doSwap() {
    if (!amount || !toBalance) return;
    setSwapping(true);
    setError(null);
    try {
      const res = await fetch("/api/wallet/swap", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token_in: from.address,
          token_out: toBalance.address,
          amount,
        }),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error ?? "Swap failed"); return; }
      onClose();
      window.location.reload();
    } catch {
      setError("Network error");
    } finally {
      setSwapping(false);
    }
  }

  return (
    <div className="spec-swap-backdrop" onClick={onClose}>
      <div className="spec-swap-modal" onClick={(e) => e.stopPropagation()}>
        <div className="spec-swap-header">
          <span className="spec-swap-title">SWAP</span>
          <button type="button" className="spec-swap-close" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
              <path d="M3 3l8 8M11 3l-8 8" />
            </svg>
          </button>
        </div>

        <div className="spec-swap-body">
          <label className="spec-swap-field-label">You pay</label>
          <div className="spec-swap-amount-row">
            <input
              type="text"
              inputMode="decimal"
              className="spec-swap-input"
              placeholder="0.00"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setQuote(null);
              }}
              autoFocus
            />
            <span className="spec-swap-input-symbol">{from.symbol}</span>
          </div>
          <div className="spec-swap-available">
            {Number(from.display).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })} {from.symbol} available
          </div>

          <label className="spec-swap-field-label">You receive</label>
          <div className="spec-swap-select-row">
            <select
              className="spec-swap-select"
              value={toToken}
              onChange={(e) => {
                setToToken(e.target.value);
                setQuote(null);
              }}
            >
              {others.map((b) => (
                <option key={b.address} value={b.symbol}>{b.symbol}</option>
              ))}
            </select>
            {toBalance && (
              <span className="spec-swap-select-bal">
                bal {Number(toBalance.display).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            )}
          </div>

          {quote && (
            <div className="spec-swap-quote">
              {Number(quote).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })} {toToken}
            </div>
          )}

          <div className="spec-swap-fee">
            <span>Fee</span>
            <span>{quote ? "< $0.01" : "—"}</span>
          </div>

          {error && <div className="spec-swap-error">{error}</div>}
        </div>

        <div className="spec-swap-actions">
          <button type="button" className="spec-swap-btn" onClick={onClose}>
            CANCEL
          </button>
          {!quote ? (
            <button
              type="button"
              className="spec-swap-btn"
              onClick={doQuote}
              disabled={quoting || !amount || !toBalance}
            >
              {quoting ? "QUOTING…" : "QUOTE"}
            </button>
          ) : (
            <button
              type="button"
              className="spec-swap-btn"
              onClick={doSwap}
              disabled={swapping}
            >
              {swapping ? "SWAPPING…" : "SWAP"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function SpecimenWalletDashboard({
  user,
  balances,
  sessions,
  payments,
  agents,
  basePath = "/oli/wallet",
  chatMessages = [],
}: {
  user: User;
  balances: Balance[];
  chart: ChartPoint[];
  sessions: Session[];
  payments: Payment[];
  agents: Agent[];
  basePath?: string;
  chatMessages?: ChatMsg[];
}) {
  const [copied, setCopied] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [swapFrom, setSwapFrom] = useState<Balance | null>(null);
  const [sendFrom, setSendFrom] = useState<Balance | null>(null);

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
  const ms7d = 7 * 24 * 3600 * 1000;
  const signedPayments7d = payments.filter(
    (p) => now - new Date(p.createdAt).getTime() <= ms7d,
  );

  const activeSessions = sessions.filter((s) => sessionState(s) === "active");
  const pendingSessions = sessions.filter((s) => sessionState(s) === "pending");
  const revokedOrExpired = sessions.filter((s) => {
    const state = sessionState(s);
    return state === "revoked" || state === "expired";
  });
  const failed7d = signedPayments7d.filter((p) =>
    ["failed", "rejected"].includes(p.status.toLowerCase()),
  ).length;
  const allowanceCap = activeSessions.reduce(
    (acc, s) => acc + Number(s.spendCapWei) / 1_000_000,
    0,
  );
  const allowanceUsed = activeSessions.reduce(
    (acc, s) => acc + Number(s.spendUsedWei) / 1_000_000,
    0,
  );
  const allowanceRemaining = Math.max(0, allowanceCap - allowanceUsed);
  const lastSpend = settled[0] ?? payments[0] ?? null;
  const nextExpiring = activeSessions
    .slice()
    .sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime())[0];
  const connectedAgents = agents.filter((agent) => agent.tokenState !== "revoked");
  const healthState =
    activeSessions.length === 0
      ? "setup needed"
      : failed7d > 0
        ? "review"
        : pendingSessions.length > 0
          ? "pending"
          : "safe";

  const passkeyLabel = user.displayName?.trim() || "iCloud Keychain";
  const pairedDevices: string[] = user.displayName?.trim()
    ? [user.displayName.trim()]
    : ["this device"];
  const pairedCount = pairedDevices.length;

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(user.managedAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
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
    <div className="spec-wallet-float">
      <section className="spec-page-header">
        <div className="spec-page-header-row">
          <h1 className="spec-page-title">
            <span>Wallet</span>
          </h1>
          <div className="spec-wallet-tabs-float">
            <WalletTabs basePath={basePath} />
          </div>
        </div>
        <div className="spec-page-subhead">
          <span className="spec-subhead-pair">
            <span className="spec-page-subhead-label">ADDR</span>
            <span className="spec-subhead-addr">{user.managedAddress}</span>
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
          </span>
          <span className="spec-subhead-pair">
            <span className="spec-page-subhead-label">PASSKEY</span>
            <span>{passkeyLabel}</span>
          </span>
          <span className="spec-page-subhead-dot">·</span>
          <span className="spec-subhead-pair">
            <span className="spec-page-subhead-label">PAIRED</span>
            <span>
              {pairedCount} {pairedCount === 1 ? "device" : "devices"}
            </span>
          </span>
        </div>
      </section>

      <section className="spec-kpi-stack">
        <div className="spec-kpi-card">
          <span className="spec-strip-label">TOTAL BALANCE</span>
          <span className="spec-strip-value spec-strip-value-lg">{fmtUsd(totalUsd)}</span>
        </div>
        <div className="spec-kpi-card spec-balances-card">
          <div className="spec-col-head">
            <span className="spec-col-head-left">HOLDINGS</span>
            <span className="spec-col-head-right">
              <span><span style={{ opacity: 0.55 }}>TOKENS</span> {balances.length}</span>
            </span>
          </div>
          {balances.length === 0 ? (
            <div style={{ padding: "20px 0", opacity: 0.6, fontSize: 12, textAlign: "center" }}>
              No balances yet. Deposit stablecoins to your wallet address.
            </div>
          ) : (
            balances.map((b) => (
              <div key={b.address} className="spec-holding-row">
                <TokenIcon symbol={b.symbol} />
                <span className="spec-holding-symbol">{b.symbol}</span>
                <span className="spec-holding-amount">{fmtUsd(Number(b.display))}</span>
                <span className="spec-holding-actions">
                  {balances.length >= 2 && (
                    <button
                      type="button"
                      className="spec-holding-action"
                      title={`Swap ${b.symbol}`}
                      onClick={() => setSwapFrom(b)}
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
                        <path d="M2 5h10M9 2l3 3-3 3" />
                        <path d="M12 9H2M5 12l-3-3 3-3" />
                      </svg>
                    </button>
                  )}
                  <button
                    type="button"
                    className="spec-holding-action"
                    title={`Send ${b.symbol}`}
                    onClick={() => setSendFrom(b)}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
                      <path d="M7 11V3M4 6l3-3 3 3" />
                      <path d="M3 12h8" />
                    </svg>
                  </button>
                </span>
              </div>
            ))
          )}
        </div>
        <div className="spec-kpi-card">
          <span className="spec-strip-label">SENT · 30D</span>
          <span className="spec-strip-value spec-strip-value-md">{fmtUsdCompact(sent30d)}</span>
          <span className="spec-strip-sub">
            <span>{sent30dCount} settlement{sent30dCount === 1 ? "" : "s"}</span>
            <span className="spec-strip-sub-faint">
              {sent30dCount > 0 ? `avg ${fmtUsd(sent30dAvg, 4)}` : "—"}
            </span>
          </span>
        </div>
        <div className="spec-kpi-card">
          <div className="spec-col-head">
            <span className="spec-col-head-left">KEYS &amp; DEVICES</span>
            <span className="spec-col-head-right">
              <span><span style={{ opacity: 0.55 }}>SESSIONS</span> {activeSessions.length}/{sessions.length}</span>
              <span><span style={{ opacity: 0.55 }}>DEVICES</span> {pairedCount}</span>
            </span>
          </div>
          <div className="spec-keys-grid">
            <span className="spec-meta-label">active keys</span>
            <span>{activeSessions.length} of {sessions.length} issued</span>
            {pendingSessions.length > 0 && (
              <>
                <span className="spec-meta-label">pending</span>
                <span>{pendingSessions.length} awaiting approval</span>
              </>
            )}
            <span className="spec-meta-label">paired</span>
            <span>{pairedDevices.join(" · ")}</span>
            <span className="spec-meta-label">passkey</span>
            <span>{passkeyLabel}</span>
          </div>
        </div>
      </section>

      {swapFrom && (
        <SwapModal
          from={swapFrom}
          balances={balances}
          onClose={() => setSwapFrom(null)}
        />
      )}
      {sendFrom && (
        <SendModal
          from={sendFrom}
          onClose={() => setSendFrom(null)}
        />
      )}

      <section className="spec-cols" style={{ paddingBottom: 48 }}>
        <ActivityColumn payments={signedPayments7d} basePath={basePath} />
        <RightRail
          sessions={sessions}
          agents={connectedAgents}
          basePath={basePath}
          revoking={revoking}
          onRevoke={onRevoke}
          expiredCount={revokedOrExpired.length}
          chatMessages={chatMessages}
        />
      </section>

      <ChatDrawer agentNames={Object.fromEntries(connectedAgents.map((a) => [a.id, a.clientName.replace(/\s*\(.*\)$/, "")]))} initialMessages={chatMessages} />
    </div>
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
            <span className="spec-pay-col-when" style={{ width: 80, flexShrink: 0 }}>WHEN</span>
            <span className="spec-pay-col-tx" style={{ width: 92, flexShrink: 0 }}>TX</span>
            <span style={{ flex: 1, minWidth: 0 }}>PAYMENT / POLICY</span>
            <span className="spec-pay-col-session spec-cell-r" style={{ width: 86, flexShrink: 0 }}>
              SESSION
            </span>
            <span className="spec-pay-col-amount spec-cell-r" style={{ width: 100, flexShrink: 0 }}>
              AMOUNT
            </span>
            <span style={{ width: 70, flexShrink: 0 }} className="spec-cell-r">
              STATUS
            </span>
          </div>
          {payments.map((p) => (
            <SpecimenPaymentRow key={p.id} payment={p} basePath={basePath} />
          ))}
        </>
      )}
    </div>
  );
}

function RightRail({
  sessions,
  agents,
  basePath,
  revoking,
  onRevoke,
  expiredCount,
  chatMessages = [],
}: {
  sessions: Session[];
  agents: Agent[];
  basePath: string;
  revoking: string | null;
  onRevoke: (id: string) => void;
  expiredCount: number;
  chatMessages?: ChatMsg[];
}) {
  const active = sessions.filter((s) => sessionState(s) === "active");
  const pending = sessions.filter((s) => sessionState(s) === "pending");
  const visibleActive = active.slice(0, 4);
  const primaryAgent = agents[0] ?? null;
  const agentNames: Record<string, string> = {};
  for (const a of agents) agentNames[a.id] = a.clientName.replace(/\s*\(.*\)$/, "");
  return (
    <div className="spec-col-rail">
      <AgentIdentityCard agent={primaryAgent} basePath={basePath} />

      <ChatRailCard basePath={basePath} agentNames={agentNames} initialMessages={chatMessages} />

      <div className="spec-col-head">
        <span className="spec-col-head-left">ACTIVE SESSION KEYS</span>
        <span className="spec-col-head-right">
          <span>
            <span style={{ opacity: 0.55 }}>QUOTA</span>{" "}
            {active.length} / {sessions.length}
          </span>
          {expiredCount > 0 && (
            <span>
              <span style={{ opacity: 0.55 }}>INACTIVE</span> {expiredCount}
            </span>
          )}
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
          const remaining = Math.max(0, cap - used);
          const usage = pct(used, cap);
          const agent = agents.find((a) => a.sessionId === s.id);
          return (
            <div key={s.id} className="spec-session-card">
              <div className="spec-session-top">
                <span className="spec-session-name-stack">
                  <Link href={`${basePath}/dashboard/sessions/${s.id}`}>
                    {s.label ?? s.id.slice(0, 8)}
                  </Link>
                  {agent && (
                    <Link
                      href={`${basePath}/chat?agent=${agent.id}`}
                      className="spec-session-agent-link"
                    >
                      {agent.clientName.replace(/\s*\(.*\)$/, "")}
                    </Link>
                  )}
                </span>
                <span className="spec-pill">[ ACTIVE ]</span>
              </div>
              <div className="spec-session-usage">
                <div className="spec-session-usage-row">
                  <span>{fmtUsd(remaining, 4)} remaining</span>
                  <span>{usage.toFixed(0)}% used</span>
                </div>
                <div className="spec-session-progress" aria-hidden="true">
                  <span style={{ width: `${usage}%` }} />
                </div>
              </div>
              <div className="spec-meta-grid">
                <span className="spec-meta-label">issued</span>
                <span>{timeAgo(s.createdAt)}</span>
                <span className="spec-meta-label">expires</span>
                <span>in {expiryIn(s.expiresAt)}</span>
                <span className="spec-meta-label">per call</span>
                <span>≤ {fmtUsd(perCall, 4)} / call</span>
                <span className="spec-meta-label">total cap</span>
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
