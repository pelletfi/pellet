"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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

export function Settings({ user, activeSessionCount }: { user: User; activeSessionCount: number }) {
  const [busy, setBusy] = useState<Busy>("none");
  const [baseUrl, setBaseUrl] = useState<string>("");

  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  const onSignOut = async () => {
    setBusy("signOut");
    try {
      await fetch("/api/wallet/me/sign-out", { method: "POST" });
      window.location.href = "/wallet/sign-in";
    } finally {
      setBusy("none");
    }
  };

  const onRevokeAll = async () => {
    if (activeSessionCount === 0) return;
    if (!confirm(`Revoke all ${activeSessionCount} active session(s)? Bearers die immediately. On-chain keys still expire on schedule.`)) return;
    setBusy("revokeAll");
    try {
      const res = await fetch("/api/wallet/sessions/revoke-all", { method: "POST" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(`revoke-all failed: ${d.error ?? res.statusText}`);
        return;
      }
      window.location.href = "/wallet/dashboard";
    } finally {
      setBusy("none");
    }
  };

  const onDelete = async () => {
    const confirm1 = prompt(
      `Delete this wallet record? Type DELETE to confirm.\n\nThis removes server-side sessions and history. Your funds remain on-chain at ${user.managedAddress.slice(0, 10)}…${user.managedAddress.slice(-6)}; only a fresh passkey enrollment can recover them.`,
    );
    if (confirm1 !== "DELETE") return;
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
    <div className="set-page">
      <style>{styles}</style>

      <Link href="/wallet/dashboard" className="set-back">← dashboard</Link>

      <header className="set-head">
        <span className="set-kicker">Pellet Wallet · Settings</span>
        <h1 className="set-h1">Account</h1>
      </header>

      {/* Wallet identity */}
      <section className="set-card">
        <header className="set-card-head">
          <h2 className="set-card-h2">Identity</h2>
          <span className="set-card-meta">passkey-rooted · self-custody</span>
        </header>
        <div className="set-grid">
          <Field label="managed address" value={user.managedAddress} mono />
          <Field label="display name" value={user.displayName ?? "—"} />
          <Field label="created" value={formatAbsolute(user.createdAt)} mono />
          <Field label="last seen" value={formatAbsolute(user.lastSeenAt)} mono />
        </div>
      </section>

      {/* Passkey */}
      <section className="set-card">
        <header className="set-card-head">
          <h2 className="set-card-h2">Passkey</h2>
          <span className="set-card-meta">credential bound to this device</span>
        </header>
        <div className="set-grid">
          <Field
            label="credential id"
            value={truncMid(user.passkeyCredentialId, 14, 8)}
            mono
            copyValue={user.passkeyCredentialId}
          />
          <Field
            label="public key"
            value={truncMid(user.passkeyPubKeyHex, 14, 8)}
            mono
            copyValue={user.passkeyPubKeyHex}
          />
          <Field label="sign count" value={user.passkeySignCount.toString()} mono />
          <Field label="recovery" value="single passkey · multi-credential coming in mainnet hardening" />
        </div>
      </section>

      {/* Environment */}
      <section className="set-card">
        <header className="set-card-head">
          <h2 className="set-card-h2">Environment</h2>
          <span className="set-card-meta">testnet · Moderato</span>
        </header>
        <div className="set-grid">
          <Field label="base url" value={baseUrl || "—"} mono copyValue={baseUrl} />
          <Field label="chain" value="Tempo Moderato (chainId 42431)" mono />
          <Field label="user id" value={user.id} mono copyValue={user.id} />
        </div>
      </section>

      {/* Danger zone */}
      <section className="set-card set-card-danger">
        <header className="set-card-head">
          <h2 className="set-card-h2">Danger zone</h2>
          <span className="set-card-meta">irreversible actions</span>
        </header>
        <div className="set-danger-row">
          <div className="set-danger-text">
            <div className="set-danger-title">Sign out</div>
            <div className="set-danger-sub">Clear the browser session cookie. Sessions and on-chain keys remain.</div>
          </div>
          <button className="set-btn" onClick={onSignOut} disabled={busy !== "none"}>
            {busy === "signOut" ? "…" : "sign out"}
          </button>
        </div>
        <div className="set-danger-row">
          <div className="set-danger-text">
            <div className="set-danger-title">Revoke all sessions</div>
            <div className="set-danger-sub">
              {activeSessionCount === 0
                ? "No active sessions to revoke."
                : `Kill all ${activeSessionCount} active agent bearer(s). On-chain access keys still expire on schedule.`}
            </div>
          </div>
          <button
            className="set-btn"
            onClick={onRevokeAll}
            disabled={busy !== "none" || activeSessionCount === 0}
          >
            {busy === "revokeAll" ? "…" : "revoke all"}
          </button>
        </div>
        <div className="set-danger-row">
          <div className="set-danger-text">
            <div className="set-danger-title set-danger-strong">Delete wallet record</div>
            <div className="set-danger-sub">
              Removes the server-side user, sessions, and spend log. Your funds remain on-chain — re-enroll the same passkey on a new device to recover access.
            </div>
          </div>
          <button className="set-btn set-btn-danger" onClick={onDelete} disabled={busy !== "none"}>
            {busy === "delete" ? "deleting…" : "delete"}
          </button>
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
  copyValue,
}: {
  label: string;
  value: string;
  mono?: boolean;
  copyValue?: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!copyValue) return;
    try {
      await navigator.clipboard.writeText(copyValue);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <div className="set-field">
      <span className="set-field-label">{label}</span>
      <div className="set-field-value-row">
        <span className={`set-field-value${mono ? " set-mono" : ""}`}>{value}</span>
        {copyValue && (
          <button className="set-copy" onClick={copy} aria-label={`copy ${label}`}>
            {copied ? "✓" : "copy"}
          </button>
        )}
      </div>
    </div>
  );
}

function truncMid(s: string, head: number, tail: number): string {
  if (s.length <= head + tail + 1) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

function formatAbsolute(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const styles = `
  .set-page {
    max-width: 880px;
    margin: 0 auto;
    padding: 32px 32px 96px;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }
  .set-back {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--color-text-quaternary);
    text-decoration: none;
    letter-spacing: 0.04em;
  }
  .set-back:hover { color: var(--color-accent); }
  .set-head { display: flex; flex-direction: column; gap: 4px; }
  .set-kicker {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--color-text-quaternary);
  }
  .set-h1 {
    font-family: 'Instrument Serif', Georgia, serif;
    font-style: italic;
    font-size: 40px;
    font-weight: 400;
    margin: 0;
    letter-spacing: -0.02em;
  }
  .set-card {
    border: 1px solid var(--color-border-subtle);
    padding: 20px 24px;
    background: var(--color-bg-base);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .set-card-danger { border-color: rgba(255, 90, 90, 0.18); }
  .set-card-head {
    display: flex;
    align-items: baseline;
    gap: 12px;
    padding-bottom: 12px;
    margin-bottom: 4px;
    border-bottom: 1px solid var(--color-border-subtle);
  }
  /* Type pattern (locked across wallet pages): h1 italic + stat-value italic;
   * h2 upright. h1 size varies by surface importance; h2 fixed at 22. */
  .set-card-h2 {
    font-family: 'Instrument Serif', Georgia, serif;
    font-size: 22px;
    font-weight: 400;
    margin: 0;
    flex: 1;
    letter-spacing: -0.01em;
  }
  .set-card-meta {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--color-text-quaternary);
    letter-spacing: 0.04em;
  }
  .set-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 1px;
    background: var(--color-border-subtle);
    border: 1px solid var(--color-border-subtle);
  }
  .set-field {
    background: var(--color-bg-base);
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }
  .set-field-label {
    font-family: var(--font-mono);
    font-size: 9px;
    color: var(--color-text-quaternary);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .set-field-value-row {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }
  .set-field-value {
    font-size: 13px;
    color: var(--color-text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
    flex: 1;
  }
  .set-mono {
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    font-size: 12px;
  }
  .set-copy {
    background: transparent;
    border: 1px solid var(--color-border-subtle);
    color: var(--color-text-tertiary);
    padding: 3px 8px;
    font-family: var(--font-mono);
    font-size: 10px;
    cursor: pointer;
    letter-spacing: 0.04em;
    flex-shrink: 0;
  }
  .set-copy:hover { border-color: var(--color-accent); color: var(--color-accent); }
  .set-danger-row {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 14px 0;
    border-bottom: 1px solid var(--color-border-subtle);
  }
  .set-danger-row:last-child { border-bottom: 0; }
  .set-danger-text { flex: 1; display: flex; flex-direction: column; gap: 4px; }
  .set-danger-title {
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--color-text-primary);
    letter-spacing: 0.02em;
  }
  .set-danger-strong { color: rgba(255, 130, 130, 0.95); }
  .set-danger-sub {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--color-text-tertiary);
    line-height: 1.5;
  }
  .set-btn {
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
    flex-shrink: 0;
  }
  .set-btn:hover { border-color: var(--color-accent); color: var(--color-text-primary); }
  .set-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .set-btn-danger { color: rgba(255, 130, 130, 0.95); border-color: rgba(255, 90, 90, 0.3); }
  .set-btn-danger:hover { border-color: rgba(255, 90, 90, 0.6); color: rgba(255, 160, 160, 1); }
  @media (max-width: 600px) {
    .set-danger-row { flex-direction: column; align-items: flex-start; }
  }
`;
