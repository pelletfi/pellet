"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { WalletTabs } from "@/components/oli/WalletTabs";
import { createWalletClient, http } from "viem";
import { tempoModerato, tempo as tempoMainnet } from "viem/chains";
import { Account, withRelay, tempoActions } from "viem/tempo";

type Agent = {
  id: string;
  clientId: string;
  clientName: string;
  clientType: "cimd" | "pre" | "dynamic";
  scopes: string[];
  connectedAt: string;
  lastSeenAt: string;
  tokenExpiresAt: string | null;
  tokenState: "active" | "expired" | "revoked" | "missing";
  activeTokenCount: number;
  webhookEnabled: boolean;
  sessionId: string | null;
};

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

type IssuingState = {
  clientId: string;
  stage: "caps" | "init" | "signing" | "broadcasting" | "finalizing";
  error?: string;
} | null;

type InitResponse = {
  session_id: string;
  credential_id: string;
  public_key_uncompressed: `0x${string}`;
  managed_address: `0x${string}`;
  rp_id: string;
  agent_key_address: `0x${string}`;
  agent_private_key: `0x${string}`;
  chain: {
    id: number;
    name: string;
    rpc_url: string;
    sponsor_url: string | null;
    explorer_url: string;
    usdc_e: `0x${string}`;
  };
  account_keychain_address: `0x${string}`;
  expiry_unix: number;
  spend_cap_wei: string;
  per_call_cap_wei: string;
  client_id: string | null;
};

const PRESET_CAPS = [
  { label: "$5 / 24h", spendCapUsdc: 5, perCallUsdc: 1, ttlSeconds: 24 * 3600 },
  { label: "$25 / 7d", spendCapUsdc: 25, perCallUsdc: 5, ttlSeconds: 7 * 24 * 3600 },
  { label: "$100 / 30d", spendCapUsdc: 100, perCallUsdc: 10, ttlSeconds: 30 * 24 * 3600 },
];

const TRANSFER_WITH_MEMO = "0x95777d59" as const;

function fmtAgo(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function fmtUntil(iso: string | null): string {
  if (!iso) return "none";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "expired";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `in ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `in ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `in ${h}h`;
  return `in ${Math.floor(h / 24)}d`;
}

function fmtUsd(n: number, max = 2): string {
  if (!Number.isFinite(n)) return "$0";
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: max })}`;
}

function clientTypeLabel(t: Agent["clientType"]): string {
  if (t === "dynamic") return "DCR";
  if (t === "cimd") return "CIMD";
  return "PRE";
}

function sessionState(s: Session): "active" | "pending" | "expired" | "revoked" {
  if (s.revokedAt) return "revoked";
  if (new Date(s.expiresAt).getTime() < Date.now()) return "expired";
  if (!s.authorizeTxHash) return "pending";
  return "active";
}

function shortAddr(addr: string): string {
  return addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

export function SpecimenConnectedAgents({
  basePath,
  agents,
  sessions,
  payments,
}: {
  basePath: string;
  agents: Agent[];
  sessions: Session[];
  payments: Payment[];
}) {
  const [revoking, setRevoking] = useState<Set<string>>(new Set());
  const [revoked, setRevoked] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [issuing, setIssuing] = useState<IssuingState>(null);
  const [issueCap, setIssueCap] = useState(0);

  const visible = useMemo(
    () => agents.filter((a) => !revoked.has(a.id)),
    [agents, revoked],
  );

  const activeSessions = useMemo(
    () => sessions.filter((s) => sessionState(s) === "active"),
    [sessions],
  );

  const recentPayments = useMemo(
    () => payments.slice(0, 10),
    [payments],
  );

  async function revokeAgent(agentId: string) {
    setRevoking((prev) => new Set(prev).add(agentId));
    setError(null);
    try {
      const res = await fetch(`/api/wallet/agents/${agentId}/revoke`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `failed (${res.status})`);
      }
      setRevoked((prev) => new Set(prev).add(agentId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "revoke failed");
    } finally {
      setRevoking((prev) => {
        const next = new Set(prev);
        next.delete(agentId);
        return next;
      });
    }
  }

  async function revokeSession(sessionId: string) {
    setRevoking((prev) => new Set(prev).add(sessionId));
    setError(null);
    try {
      const res = await fetch(`/api/wallet/sessions/${sessionId}/revoke`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `failed (${res.status})`);
      }
      setRevoked((prev) => new Set(prev).add(sessionId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "revoke failed");
    } finally {
      setRevoking((prev) => {
        const next = new Set(prev);
        next.delete(sessionId);
        return next;
      });
    }
  }

  async function issueKey(clientId: string) {
    const cap = PRESET_CAPS[issueCap];

    setIssuing({ clientId, stage: "init" });
    setError(null);

    let init: InitResponse;
    try {
      const res = await fetch("/api/wallet/sessions/issue", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          spend_cap_wei: String(cap.spendCapUsdc * 1_000_000),
          per_call_cap_wei: String(cap.perCallUsdc * 1_000_000),
          session_ttl_seconds: cap.ttlSeconds,
          client_id: clientId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setIssuing({ clientId, stage: "caps", error: data.error ?? "issue failed" });
        return;
      }
      init = data as InitResponse;
    } catch (e) {
      setIssuing({ clientId, stage: "caps", error: e instanceof Error ? e.message : String(e) });
      return;
    }

    setIssuing({ clientId, stage: "signing" });
    let txHash: `0x${string}`;
    try {
      const userAccount = Account.fromWebAuthnP256(
        {
          id: init.credential_id,
          publicKey: init.public_key_uncompressed,
        },
        { rpId: init.rp_id },
      );

      const accessKey = Account.fromSecp256k1(init.agent_private_key, {
        access: userAccount,
      });

      const baseChain =
        init.chain.id === tempoMainnet.id ? tempoMainnet : tempoModerato;
      const chain = { ...baseChain, feeToken: init.chain.usdc_e };

      const transport = init.chain.sponsor_url
        ? withRelay(http(init.chain.rpc_url), http(init.chain.sponsor_url), {
            policy: "sign-only",
          })
        : http(init.chain.rpc_url);

      const client = createWalletClient({
        account: userAccount,
        chain,
        transport,
      }).extend(tempoActions());

      setIssuing({ clientId, stage: "broadcasting" });
      const result = await client.accessKey.authorizeSync({
        accessKey,
        expiry: init.expiry_unix,
        feePayer: true,
        gas: BigInt(5_000_000),
        limits: [
          {
            token: init.chain.usdc_e,
            limit: BigInt(init.spend_cap_wei),
            period: 86400,
          },
        ],
        scopes: [
          { address: init.chain.usdc_e, selector: TRANSFER_WITH_MEMO },
        ],
      });
      txHash = result.receipt.transactionHash as `0x${string}`;
    } catch (e) {
      setIssuing({
        clientId,
        stage: "caps",
        error: "on-chain authorize failed: " + (e instanceof Error ? e.message : String(e)),
      });
      return;
    }

    setIssuing({ clientId, stage: "finalizing" });
    try {
      const finRes = await fetch("/api/wallet/sessions/issue-finalize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          session_id: init.session_id,
          tx_hash: txHash,
          client_id: clientId,
        }),
      });
      const finData = await finRes.json();
      if (!finRes.ok) {
        setIssuing({
          clientId,
          stage: "caps",
          error: finData.error ?? "finalize failed",
        });
        return;
      }
    } catch (e) {
      setIssuing({
        clientId,
        stage: "caps",
        error: e instanceof Error ? e.message : String(e),
      });
      return;
    }

    setIssuing(null);
    window.location.reload();
  }

  return (
    <div className="spec-wallet-float">
      <section className="spec-page-header">
        <div className="spec-page-header-row">
          <h1 className="spec-page-title">
            <span>Wallet · Agents</span>
          </h1>
          <div className="spec-wallet-tabs-float">
            <WalletTabs basePath={basePath} />
          </div>
        </div>
        <div className="spec-page-subhead">
          <span className="spec-page-subhead-label">CONNECTED</span>
          <span>{visible.length}</span>
          <span className="spec-page-subhead-dot">·</span>
          <span className="spec-page-subhead-label">KEYS</span>
          <span>{activeSessions.length} active</span>
        </div>
      </section>

      {visible.length === 0 ? (
        <section className="spec-agents-empty">
          <h2 className="spec-agents-empty-head">no agents connected</h2>
          <p className="spec-agents-empty-hint">
            Add Pellet to your AI client to grant it wallet access.
            Walk through the connection cards at{" "}
            <Link href={`${basePath}/onboard`}>Connect</Link>, or read the
            full setup at <Link href="/mcp-docs">the MCP guide</Link>.
          </p>
        </section>
      ) : (
        <>
          {/* ── Identity ──────────────────────────────────── */}
          {visible.map((a) => {
            const isIssuingThis = issuing?.clientId === a.clientId;
            const needsKey = !a.sessionId && a.tokenState === "active";

            return (
              <div key={a.id} className="spec-agent-detail-card">
                <div className="spec-agent-detail-top">
                  <div className="spec-agent-detail-name">
                    <span className="spec-agent-detail-title">{a.clientName.replace(/\s*\(.*\)$/, "")}</span>
                    <span className="spec-agent-detail-meta">
                      <span className={`spec-agents-tag spec-agents-tag-${a.clientType}`}>
                        {clientTypeLabel(a.clientType)}
                      </span>
                      <span className="spec-faint">{a.clientId.slice(0, 24)}{a.clientId.length > 24 ? "…" : ""}</span>
                    </span>
                  </div>
                  <div className="spec-agent-detail-status">
                    <span className={`spec-agents-token-state spec-agents-token-state-${a.tokenState}`}>
                      {a.tokenState}
                    </span>
                    <button
                      type="button"
                      className="spec-agents-revoke"
                      disabled={revoking.has(a.id)}
                      onClick={() => void revokeAgent(a.id)}
                    >
                      {revoking.has(a.id) ? "…" : "REVOKE"}
                    </button>
                  </div>
                </div>
                <div className="spec-agent-detail-grid">
                  <span className="spec-meta-label">scopes</span>
                  <span>{a.scopes.map((s) => s.replace(/^wallet:/, "")).join(" · ")}</span>
                  <span className="spec-meta-label">connected</span>
                  <span>{fmtAgo(a.connectedAt)}</span>
                  <span className="spec-meta-label">last seen</span>
                  <span>{fmtAgo(a.lastSeenAt)}</span>
                  <span className="spec-meta-label">token</span>
                  <span>{fmtUntil(a.tokenExpiresAt)}</span>
                  <span className="spec-meta-label">transport</span>
                  <span>{a.webhookEnabled ? "webhook" : "poll"}</span>
                  <span className="spec-meta-label">access key</span>
                  <span>{a.sessionId ? "linked" : "none"}</span>
                </div>

                {/* ── Inline issue key flow ── */}
                {needsKey && !isIssuingThis && (
                  <button
                    type="button"
                    className="spec-issue-key-btn"
                    onClick={() => {
                      setIssueCap(0);
                      setIssuing({ clientId: a.clientId, stage: "caps" });
                    }}
                  >
                    ISSUE ACCESS KEY
                  </button>
                )}

                {isIssuingThis && issuing.stage === "caps" && (
                  <div className="spec-issue-inline">
                    <div className="spec-issue-cap-grid">
                      {PRESET_CAPS.map((c, i) => (
                        <button
                          key={c.label}
                          type="button"
                          className="spec-issue-cap-btn"
                          style={{
                            background: i === issueCap ? "var(--fg)" : "transparent",
                            color: i === issueCap ? "var(--bg)" : "var(--fg)",
                            borderColor: i === issueCap ? "var(--fg)" : undefined,
                          }}
                          onClick={() => setIssueCap(i)}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                    {issuing.error && (
                      <div className="spec-issue-error">{issuing.error}</div>
                    )}
                    <div className="spec-issue-actions">
                      <button
                        type="button"
                        className="spec-issue-key-btn"
                        onClick={() => void issueKey(a.clientId)}
                      >
                        APPROVE · {PRESET_CAPS[issueCap].label}
                      </button>
                      <button
                        type="button"
                        className="spec-agents-revoke"
                        onClick={() => setIssuing(null)}
                      >
                        CANCEL
                      </button>
                    </div>
                  </div>
                )}

                {isIssuingThis && issuing.stage !== "caps" && (
                  <div className="spec-issue-progress">
                    <div style={{ opacity: issuing.stage === "init" ? 1 : 0.4 }}>· preparing key</div>
                    <div style={{ opacity: issuing.stage === "signing" ? 1 : 0.4 }}>· waiting for passkey</div>
                    <div style={{ opacity: issuing.stage === "broadcasting" ? 1 : 0.4 }}>· broadcasting tx</div>
                    <div style={{ opacity: issuing.stage === "finalizing" ? 1 : 0.4 }}>· finalizing</div>
                  </div>
                )}
              </div>
            );
          })}

          {/* ── Session Keys ──────────────────────────────── */}
          <div className="spec-page-subhead" style={{ paddingTop: 4, paddingLeft: 8 }}>
            <span className="spec-page-subhead-label">SESSION KEYS</span>
            <span>{activeSessions.filter((s) => !revoked.has(s.id)).length} / {sessions.length}</span>
            <span className="spec-page-subhead-dot">·</span>
            <span className="spec-page-subhead-label">ACTIVE</span>
            <span>{activeSessions.filter((s) => !revoked.has(s.id)).length}</span>
          </div>

          {activeSessions.filter((s) => !revoked.has(s.id)).length === 0 ? (
            <div style={{ padding: "20px 0", opacity: 0.5, fontSize: 12, textAlign: "center" }}>
              No active session keys.
            </div>
          ) : (
            activeSessions.filter((s) => !revoked.has(s.id)).map((s) => {
              const cap = Number(s.spendCapWei) / 1_000_000;
              const used = Number(s.spendUsedWei) / 1_000_000;
              const perCall = Number(s.perCallCapWei) / 1_000_000;
              const remaining = Math.max(0, cap - used);
              const usage = cap > 0 ? Math.min(100, (used / cap) * 100) : 0;
              return (
                <div key={s.id} className="spec-session-card">
                  <div className="spec-session-top">
                    <span className="spec-session-name-stack">
                      <Link href={`${basePath}/dashboard/sessions/${s.id}`}>
                        {s.label ?? s.id.slice(0, 8)}
                      </Link>
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
                    <span>{fmtAgo(s.createdAt)}</span>
                    <span className="spec-meta-label">expires</span>
                    <span>{fmtUntil(s.expiresAt)}</span>
                    <span className="spec-meta-label">per call</span>
                    <span>≤ {fmtUsd(perCall, 4)} / call</span>
                    <span className="spec-meta-label">total cap</span>
                    <span>{fmtUsd(used, 4)} / {fmtUsd(cap)}</span>
                  </div>
                  <div style={{ alignSelf: "flex-end" }}>
                    <button
                      type="button"
                      className="spec-agents-revoke"
                      disabled={revoking.has(s.id)}
                      onClick={() => void revokeSession(s.id)}
                    >
                      {revoking.has(s.id) ? "…" : "REVOKE"}
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
            <span className="spec-keycap" aria-hidden="true">+</span>
            <span>ISSUE NEW KEY</span>
          </Link>

          {/* ── Activity ──────────────────────────────────── */}
          <div className="spec-page-subhead" style={{ paddingTop: 4, paddingLeft: 8 }}>
            <span className="spec-page-subhead-label">RECENT ACTIVITY</span>
            <span>{payments.length} total</span>
          </div>

          {recentPayments.length === 0 ? (
            <div style={{ padding: "20px 0", opacity: 0.5, fontSize: 12, textAlign: "center" }}>
              No activity yet.
            </div>
          ) : (
            recentPayments.map((p) => (
              <div key={p.id} className="spec-activity-row">
                <div className="spec-activity-head" style={{ padding: 0 }}>
                  <span style={{ flex: 1 }}>{shortAddr(p.recipient)}</span>
                  <span>{fmtUsd(Number(p.amountWei) / 1_000_000)}</span>
                  <span className={`spec-status-pill spec-status-pill-${p.status === "confirmed" ? "ok" : "pending"}`}>
                    {p.status}
                  </span>
                  <span style={{ opacity: 0.55, minWidth: 60, textAlign: "right" }}>{fmtAgo(p.createdAt)}</span>
                </div>
              </div>
            ))
          )}
        </>
      )}

      {error && (
        <p className="spec-agents-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
