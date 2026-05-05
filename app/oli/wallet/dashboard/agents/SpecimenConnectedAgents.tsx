"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { WalletTabs } from "@/components/oli/WalletTabs";
import { LiquidGlass } from "@/components/oli/LiquidGlass";

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
};

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

function clientTypeLabel(t: Agent["clientType"]): string {
  if (t === "dynamic") return "DCR";
  if (t === "cimd") return "CIMD";
  return "PRE";
}

function tokenLabel(a: Agent): string {
  if (a.tokenState === "active") return fmtUntil(a.tokenExpiresAt);
  if (a.tokenState === "expired") return "expired";
  if (a.tokenState === "revoked") return "revoked";
  return "no token";
}

export function SpecimenConnectedAgents({
  basePath,
  agents,
}: {
  basePath: string;
  agents: Agent[];
}) {
  const [revoking, setRevoking] = useState<Set<string>>(new Set());
  const [revoked, setRevoked] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const visible = useMemo(
    () => agents.filter((a) => !revoked.has(a.id)),
    [agents, revoked],
  );

  async function revoke(agentId: string) {
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

  return (
    <div className="spec-wallet-float" style={{ position: "relative", isolation: "isolate" }}>
      <LiquidGlass
        style={{ position: "absolute", inset: 0, zIndex: -1, pointerEvents: "none" }}
      />
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
          <span className="spec-page-subhead-label">METHOD</span>
          <span>OAuth 2.1 + PKCE · durable registry</span>
        </div>
      </section>

      {visible.length === 0 ? (
        <section className="spec-agents-empty">
          <h2 className="spec-agents-empty-head">no agents connected</h2>
          <p className="spec-agents-empty-hint">
            Add Pellet to your AI client to grant it wallet access.
            Walk through the connection cards at{" "}
            <Link href={`${basePath}/onboard`}>Connect</Link>, or read the
            full setup at <Link href="/oli/mcp">/oli/mcp</Link>.
          </p>
        </section>
      ) : (
        <section className="spec-agents-table" aria-label="Connected agents">
          <header className="spec-agents-row spec-agents-row-head">
            <span>AGENT</span>
            <span>SCOPES</span>
            <span>CONNECTED</span>
            <span>LAST SEEN</span>
            <span>TOKEN</span>
            <span />
          </header>
          {visible.map((a) => (
            <div key={a.id} className="spec-agents-row">
              <span className="spec-agents-cell-name">
                <span className="spec-agents-name">{a.clientName}</span>
                <span className="spec-agents-meta">
                  <span className={`spec-agents-tag spec-agents-tag-${a.clientType}`}>
                    {clientTypeLabel(a.clientType)}
                  </span>
                  <span className="spec-agents-id">
                    {a.clientId.slice(0, 24)}
                    {a.clientId.length > 24 ? "…" : ""}
                  </span>
                  {a.webhookEnabled && (
                    <span className="spec-agents-id">WEBHOOK</span>
                  )}
                </span>
              </span>
              <span className="spec-agents-cell-scopes">
                {a.scopes.length === 0 ? (
                  <span className="spec-agents-scope">none</span>
                ) : (
                  a.scopes.map((s) => (
                    <span key={s} className="spec-agents-scope">
                      {s}
                    </span>
                  ))
                )}
              </span>
              <span className="spec-agents-cell-time">{fmtAgo(a.connectedAt)}</span>
              <span className="spec-agents-cell-time">
                {fmtAgo(a.lastSeenAt)}
              </span>
              <span className="spec-agents-cell-time spec-agents-token">
                <span className={`spec-agents-token-state spec-agents-token-state-${a.tokenState}`}>
                  {a.tokenState}
                </span>
                <span>{tokenLabel(a)}</span>
                {a.activeTokenCount > 1 && <span>{a.activeTokenCount} active</span>}
              </span>
              <span className="spec-agents-cell-action">
                <Link
                  className="spec-agents-chat"
                  href={`${basePath}/chat?agent=${a.id}`}
                  title="Open this agent's wallet chat thread."
                >
                  CHAT
                </Link>
                <button
                  type="button"
                  className="spec-agents-revoke"
                  disabled={revoking.has(a.id)}
                  onClick={() => void revoke(a.id)}
                  title="Disconnect this agent and revoke its OAuth tokens."
                >
                  {revoking.has(a.id) ? "…" : "REVOKE"}
                </button>
              </span>
            </div>
          ))}
        </section>
      )}
      {error && (
        <p className="spec-agents-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
