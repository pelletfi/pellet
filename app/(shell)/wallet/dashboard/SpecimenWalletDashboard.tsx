"use client";

import { useState } from "react";
import Link from "next/link";
import { AgentIdentityCard } from "@/components/oli/AgentIdentityCard";
import { WalletTabs } from "@/components/oli/WalletTabs";
import { MPP_PRESETS, MPP_SERVICES } from "@/lib/mpp";
import { TerminalCard } from "@/app/(shell)/wallet/dashboard/TerminalCard";

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
  basePath = "/wallet",
  chatMessages = [],
  testnet = false,
}: {
  user: User;
  balances: Balance[];
  chart: ChartPoint[];
  sessions: Session[];
  payments: Payment[];
  agents: Agent[];
  basePath?: string;
  chatMessages?: ChatMsg[];
  testnet?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [swapFrom, setSwapFrom] = useState<Balance | null>(null);
  const [sendFrom, setSendFrom] = useState<Balance | null>(null);
  const [dripping, setDripping] = useState(false);

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
          {testnet && (
            <button
              type="button"
              className="spec-faucet-btn"
              disabled={dripping}
              onClick={async () => {
                setDripping(true);
                try {
                  const res = await fetch("/api/wallet/faucet", { method: "POST" });
                  const d = await res.json();
                  if (!res.ok) { alert(d.error ?? "Faucet failed"); return; }
                  window.location.reload();
                } catch {
                  alert("Faucet request failed");
                } finally {
                  setDripping(false);
                }
              }}
            >
              {dripping ? "DRIPPING…" : "TESTNET FAUCET"}
            </button>
          )}
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
        <ActivityColumn
          address={user.managedAddress}
          paired={pairedCount}
          agents={connectedAgents.length}
          sessions={activeSessions.length}
        />
        <RightRail
          sessions={sessions}
          agents={connectedAgents}
          basePath={basePath}
          revoking={revoking}
          onRevoke={onRevoke}
          expiredCount={revokedOrExpired.length}
        />
      </section>

    </div>
  );
}

function ActivityColumn({
  address,
  paired,
  agents,
  sessions,
}: {
  address: string;
  paired: number;
  agents: number;
  sessions: number;
}) {
  return (
    <div className="spec-col-activity">
      <TerminalCard address={address} paired={paired} agents={agents} sessions={sessions} />
    </div>
  );
}

const SERVICE_NAMES: Record<string, string> = Object.fromEntries(
  MPP_SERVICES.map((s) => [s.id, s.name]),
);

function PresetPicker({ basePath }: { basePath: string }) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="spec-preset-picker">
      <div className="spec-preset-list">
        {MPP_PRESETS.map((preset) => {
          const budget = Number(preset.defaultBudget) / 1_000_000;
          const active = selected === preset.id;
          return (
            <div
              key={preset.id}
              className={`spec-preset-card${active ? " spec-preset-card-active" : ""}`}
            >
              <button
                type="button"
                className="spec-preset-card-toggle"
                onClick={() => setSelected(active ? null : preset.id)}
              >
                <div className="spec-preset-card-top">
                  <span className="spec-preset-card-name">{preset.name}</span>
                  <span className="spec-preset-card-budget">${budget} budget</span>
                </div>
                <span className="spec-preset-card-desc">{preset.description}</span>
              </button>
              {active && (
                <div className="spec-preset-detail">
                  <div className="spec-preset-service-list">
                    {preset.serviceIds.map((id) => (
                      <span key={id} className="spec-preset-service-tag">
                        {SERVICE_NAMES[id] ?? id}
                      </span>
                    ))}
                  </div>
                  <Link
                    href={`${basePath}/onboard?preset=${preset.id}`}
                    className="spec-preset-activate"
                  >
                    ACTIVATE PRESET
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      </div>
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
}: {
  sessions: Session[];
  agents: Agent[];
  basePath: string;
  revoking: string | null;
  onRevoke: (id: string) => void;
  expiredCount: number;
}) {
  const active = sessions.filter((s) => sessionState(s) === "active");
  const pending = sessions.filter((s) => sessionState(s) === "pending");
  const primaryAgent = agents[0] ?? null;
  return (
    <div className="spec-col-rail">
      <AgentIdentityCard agent={primaryAgent} basePath={basePath} />

      <PresetPicker basePath={basePath} />

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
