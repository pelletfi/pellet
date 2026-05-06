"use client";

import { useState } from "react";
import Link from "next/link";
import { WalletTabs } from "@/components/oli/WalletTabs";

type User = {
  id: string;
  managedAddress: string;
  displayName: string | null;
  passkeyCredentialId: string;
  passkeyPubKeyHex: string;
  passkeySignCount: number;
  createdAt: string;
  lastSeenAt: string;
};

type Busy = "none" | "signOut" | "revokeAll" | "delete";

function fmtAbsolute(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function truncMid(s: string, head: number, tail: number): string {
  if (s.length <= head + tail + 1) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

export function SpecimenWalletSettings({
  user,
  activeSessionCount,
  chain,
  basePath = "/wallet",
}: {
  user: User;
  activeSessionCount: number;
  chain: { name: string; chainId: number; rpcUrl: string; explorerUrl: string };
  basePath?: string;
}) {
  const [busy, setBusy] = useState<Busy>("none");

  const onSignOut = async () => {
    setBusy("signOut");
    try {
      await fetch("/api/wallet/me/sign-out", { method: "POST" });
      window.location.href = `${basePath}/sign-in`;
    } finally {
      setBusy("none");
    }
  };

  const onRevokeAll = async () => {
    if (activeSessionCount === 0) return;
    if (
      !confirm(
        `Revoke all ${activeSessionCount} active session(s)? Bearers die immediately. On-chain keys still expire on schedule.`,
      )
    )
      return;
    setBusy("revokeAll");
    try {
      const res = await fetch("/api/wallet/sessions/revoke-all", { method: "POST" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(`revoke-all failed: ${d.error ?? res.statusText}`);
        return;
      }
      window.location.href = `${basePath}/dashboard`;
    } finally {
      setBusy("none");
    }
  };

  const onDelete = async () => {
    const c = prompt(
      `Delete this wallet record? Type DELETE to confirm.\n\nThis removes server-side sessions and history. Your funds remain on-chain at ${user.managedAddress.slice(0, 10)}…${user.managedAddress.slice(-6)}; only a fresh passkey enrollment can recover them.`,
    );
    if (c !== "DELETE") return;
    setBusy("delete");
    try {
      const res = await fetch("/api/wallet/me", { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(`delete failed: ${d.error ?? res.statusText}`);
        return;
      }
      window.location.href = "/";
    } finally {
      setBusy("none");
    }
  };

  return (
    <div className="spec-wallet-float">
      <section className="spec-page-header">
        <div className="spec-page-header-row">
          <h1 className="spec-page-title">
            <span>Wallet</span>
            <span className="spec-page-title-em">— settings</span>
          </h1>
          <div className="spec-wallet-tabs-float">
            <WalletTabs basePath={basePath} />
          </div>
        </div>
        <div className="spec-page-subhead">
          <span className="spec-page-subhead-label">ADDR</span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>{user.managedAddress}</span>
        </div>
      </section>

      <SettingsBlock title="IDENTITY" meta="passkey-rooted · self-custody">
        <Field label="managed address" value={user.managedAddress} copyable />
        <Field label="display name" value={user.displayName ?? "—"} />
        <Field label="created" value={fmtAbsolute(user.createdAt)} />
        <Field label="last seen" value={fmtAbsolute(user.lastSeenAt)} />
      </SettingsBlock>

      <SettingsBlock title="PASSKEY" meta="credential bound to this device">
        <Field
          label="credential id"
          value={truncMid(user.passkeyCredentialId, 14, 8)}
          copyable
          copyValue={user.passkeyCredentialId}
        />
        <Field
          label="public key"
          value={truncMid(user.passkeyPubKeyHex, 14, 8)}
          copyable
          copyValue={user.passkeyPubKeyHex}
        />
        <Field label="sign count" value={user.passkeySignCount.toString()} />
        <Field
          label="recovery"
          value="single passkey · multi-credential coming soon"
        />
      </SettingsBlock>

      <SettingsBlock title="ENVIRONMENT" meta={chain.name === "Presto" ? "mainnet · Presto" : "testnet · Moderato"}>
        <Field label="chain" value={`Tempo ${chain.name} (chainId ${chain.chainId})`} />
        <Field label="rpc" value={chain.rpcUrl} copyable />
        <Field label="explorer" value={chain.explorerUrl} copyable />
        <Field label="user id" value={user.id} copyable />
      </SettingsBlock>

      <SettingsBlock title="DANGER ZONE" meta="irreversible actions">
        <DangerRow
          title="Sign out"
          sub="Clear the browser session cookie. Sessions and on-chain keys remain."
          actionLabel={busy === "signOut" ? "SIGNING OUT…" : "SIGN OUT"}
          onAction={onSignOut}
          disabled={busy !== "none"}
        />
        <DangerRow
          title="Revoke all sessions"
          sub={
            activeSessionCount === 0
              ? "No active sessions to revoke."
              : `Kill all ${activeSessionCount} active agent bearer(s). On-chain access keys still expire on schedule.`
          }
          actionLabel={busy === "revokeAll" ? "REVOKING…" : "REVOKE ALL"}
          onAction={onRevokeAll}
          disabled={busy !== "none" || activeSessionCount === 0}
        />
        <DangerRow
          title="Delete wallet record"
          sub="Removes the server-side user, sessions, and spend log. Funds remain on-chain — re-enroll the same passkey on a new device to recover."
          actionLabel={busy === "delete" ? "DELETING…" : "DELETE"}
          onAction={onDelete}
          disabled={busy !== "none"}
        />
      </SettingsBlock>
    </div>
  );
}

function SettingsBlock({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="spec-settings-block">
      <header className="spec-col-head">
        <span className="spec-col-head-left">{title}</span>
        {meta && (
          <span className="spec-col-head-right">
            <span style={{ opacity: 0.65 }}>{meta}</span>
          </span>
        )}
      </header>
      <div className="spec-settings-grid">{children}</div>
    </section>
  );
}

function Field({
  label,
  value,
  copyable,
  copyValue,
}: {
  label: string;
  value: string;
  copyable?: boolean;
  copyValue?: string;
}) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    const v = copyValue ?? value;
    try {
      await navigator.clipboard.writeText(v);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* noop */
    }
  };
  return (
    <div className="spec-settings-field">
      <span className="spec-settings-label">{label}</span>
      <span className="spec-settings-value">
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
          {value}
        </span>
        {copyable && (
          <button
            type="button"
            onClick={onCopy}
            className="spec-settings-copy"
            aria-label={`copy ${label}`}
          >
            {copied ? "COPIED" : "COPY"}
          </button>
        )}
      </span>
    </div>
  );
}

function DangerRow({
  title,
  sub,
  actionLabel,
  onAction,
  disabled,
}: {
  title: string;
  sub: string;
  actionLabel: string;
  onAction: () => void;
  disabled: boolean;
}) {
  return (
    <div className="spec-settings-danger">
      <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 500 }}>{title}</span>
        <span style={{ fontSize: 12, opacity: 0.7, lineHeight: 1.45 }}>{sub}</span>
      </div>
      <button
        type="button"
        className="spec-settings-action"
        onClick={onAction}
        disabled={disabled}
      >
        {actionLabel}
      </button>
    </div>
  );
}
