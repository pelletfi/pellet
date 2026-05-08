"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  type SubscriptionDetail,
  type Delivery,
  truncateMiddle,
  filterSummary,
  relativeTime,
} from "@/lib/wallet/webhooks-types";
import { WebhookStatusPill } from "./WebhookStatusPill";

const ACTION_BTN: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  border: "1px solid var(--color-border-default)",
  padding: "8px 14px",
  color: "var(--color-text-primary)",
  background: "transparent",
  cursor: "pointer",
};

const DANGER_BTN: React.CSSProperties = {
  ...ACTION_BTN,
  borderColor: "var(--color-error)",
  color: "var(--color-error)",
};

const SECTION_HEADER: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "var(--color-text-tertiary)",
  margin: "0 0 8px",
};

export function WebhookDetail({
  sub,
  deliveries,
  oneShotSecret,
}: {
  sub: SubscriptionDetail;
  deliveries: Delivery[];
  oneShotSecret: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verifyToken, setVerifyToken] = useState("");
  const [rotatedSecret, setRotatedSecret] = useState<string | null>(null);

  // Strip ?secret= from the URL once mounted so a refresh doesn't re-show it.
  useEffect(() => {
    if (!oneShotSecret) return;
    router.replace(pathname);
    // We intentionally don't add router/pathname to deps — replace once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const callApi = async (
    path: string,
    init: RequestInit,
    actionLabel: string,
  ): Promise<Response | null> => {
    setBusy(actionLabel);
    setError(null);
    try {
      const res = await fetch(path, {
        credentials: "include",
        ...init,
      });
      if (!res.ok) {
        let detail = "";
        try {
          const j = (await res.json()) as { error?: string; detail?: string };
          detail = j.detail ?? j.error ?? "";
        } catch {
          /* ignore */
        }
        setError(detail || `${actionLabel} failed (${res.status})`);
        return null;
      }
      return res;
    } catch (err) {
      setError(err instanceof Error ? err.message : "network error");
      return null;
    } finally {
      setBusy(null);
    }
  };

  const onPause = async () => {
    const ok = await callApi(
      `/api/webhooks/${sub.id}/pause`,
      { method: "POST" },
      "pause",
    );
    if (ok) router.refresh();
  };

  const onResume = async () => {
    const ok = await callApi(
      `/api/webhooks/${sub.id}/resume`,
      { method: "POST" },
      "resume",
    );
    if (ok) router.refresh();
  };

  const onRotate = async () => {
    const confirmed = window.confirm(
      "Rotate signing secret?\n\nThis is a HARD CUTOVER. The old secret is invalidated immediately — there is no overlap window. All future deliveries will use the new secret.\n\nContinue?",
    );
    if (!confirmed) return;
    const res = await callApi(
      `/api/webhooks/${sub.id}/rotate-secret`,
      { method: "POST" },
      "rotate",
    );
    if (!res) return;
    try {
      const j = (await res.json()) as { signing_secret?: string };
      if (j.signing_secret) setRotatedSecret(j.signing_secret);
    } catch {
      /* ignore */
    }
  };

  const onDelete = async () => {
    const confirmed = window.confirm(
      "Delete this webhook?\n\nThis cannot be undone. No further deliveries will be attempted.",
    );
    if (!confirmed) return;
    const ok = await callApi(
      `/api/webhooks/${sub.id}`,
      { method: "DELETE" },
      "delete",
    );
    if (ok) router.push("/webhooks");
  };

  const onVerify = async () => {
    if (!verifyToken.trim()) {
      setError("verify token is required");
      return;
    }
    const ok = await callApi(
      `/api/webhooks/${sub.id}/verify`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ verify_token: verifyToken.trim() }),
      },
      "verify",
    );
    if (ok) router.refresh();
  };

  const isPaused = sub.status === "paused";
  const isPendingVerify = sub.status === "pending_verify";

  return (
    <div className="wallet-page">
      <header className="wallet-page-header">
        <div style={{ minWidth: 0, flex: 1 }}>
          <Link
            href="/webhooks"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--color-text-quaternary)",
              textDecoration: "none",
            }}
          >
            ← webhooks
          </Link>
          <h1 className="wallet-page-h1" style={{ marginTop: 4 }}>
            Subscription
            <span className="wallet-page-h1-em">({sub.id.slice(0, 8)})</span>
          </h1>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "var(--color-text-secondary)",
              marginTop: 8,
              wordBreak: "break-all",
            }}
            title={sub.callback_url}
          >
            {truncateMiddle(sub.callback_url, 48, 24)}
          </div>
          {sub.label && (
            <div
              style={{
                fontSize: 12,
                color: "var(--color-text-quaternary)",
                marginTop: 2,
              }}
            >
              {sub.label}
            </div>
          )}
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--color-text-tertiary)",
              marginTop: 8,
            }}
          >
            {filterSummary(sub.filters)}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
          <WebhookStatusPill status={sub.status} />
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--color-text-quaternary)",
              letterSpacing: "0.04em",
            }}
          >
            created {relativeTime(sub.created_at)}
          </span>
        </div>
      </header>

      {oneShotSecret && (
        <SecretBanner kind="signing_secret" value={oneShotSecret} />
      )}
      {rotatedSecret && (
        <SecretBanner kind="rotated_secret" value={rotatedSecret} />
      )}

      {isPendingVerify && (
        <section
          style={{
            border: "1px solid var(--color-border-subtle)",
            background: "var(--color-bg-subtle)",
            padding: 16,
          }}
        >
          <h2 style={SECTION_HEADER}>Verify endpoint</h2>
          <p style={{ fontSize: 13, color: "var(--color-text-tertiary)", margin: "0 0 12px" }}>
            Paste the verify token your callback URL returned during the
            handshake.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              value={verifyToken}
              onChange={(e) => setVerifyToken(e.target.value)}
              placeholder="verify_token"
              style={{
                flex: 1,
                background: "transparent",
                border: "1px solid var(--color-border-default)",
                color: "var(--color-text-primary)",
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                padding: "8px 10px",
                outline: "none",
              }}
            />
            <button
              type="button"
              onClick={onVerify}
              disabled={busy === "verify"}
              style={{ ...ACTION_BTN, opacity: busy === "verify" ? 0.6 : 1 }}
            >
              {busy === "verify" ? "verifying…" : "Verify"}
            </button>
          </div>
        </section>
      )}

      <section>
        <h2 style={SECTION_HEADER}>Actions</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {isPaused ? (
            <button
              type="button"
              onClick={onResume}
              disabled={busy !== null}
              style={{ ...ACTION_BTN, opacity: busy ? 0.6 : 1 }}
            >
              {busy === "resume" ? "resuming…" : "Resume"}
            </button>
          ) : (
            <button
              type="button"
              onClick={onPause}
              disabled={busy !== null || isPendingVerify}
              style={{ ...ACTION_BTN, opacity: busy || isPendingVerify ? 0.6 : 1 }}
            >
              {busy === "pause" ? "pausing…" : "Pause"}
            </button>
          )}
          <button
            type="button"
            onClick={onRotate}
            disabled={busy !== null}
            style={{ ...ACTION_BTN, opacity: busy ? 0.6 : 1 }}
          >
            {busy === "rotate" ? "rotating…" : "Rotate secret"}
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={busy !== null}
            style={{ ...DANGER_BTN, opacity: busy ? 0.6 : 1 }}
          >
            {busy === "delete" ? "deleting…" : "Delete"}
          </button>
        </div>
      </section>

      {error && (
        <div
          style={{
            border: "1px solid var(--color-error)",
            color: "var(--color-error)",
            padding: "8px 12px",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
          }}
        >
          {error}
        </div>
      )}

      <section>
        <h2 style={SECTION_HEADER}>Recent deliveries · last 25</h2>
        <DeliveriesTable deliveries={deliveries} />
      </section>
    </div>
  );
}

function DeliveriesTable({ deliveries }: { deliveries: Delivery[] }) {
  if (deliveries.length === 0) {
    return (
      <div
        style={{
          border: "1px solid var(--line)",
          padding: "32px 24px",
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          opacity: 0.55,
          textAlign: "center",
        }}
      >
        No deliveries yet
      </div>
    );
  }
  return (
    <div>
      <div className="spec-activity-head" style={{ paddingLeft: 24 }}>
        <span style={{ width: 80, flexShrink: 0 }}>WHEN</span>
        <span style={{ width: 96, flexShrink: 0 }}>EVENT</span>
        <span style={{ width: 70, flexShrink: 0 }} className="spec-cell-r">ATTEMPTS</span>
        <span style={{ width: 96, flexShrink: 0, marginLeft: 8 }}>STATUS</span>
        <span style={{ width: 60, flexShrink: 0 }} className="spec-cell-r">CODE</span>
        <span style={{ flex: 1, minWidth: 0 }}>ERROR</span>
      </div>
      {deliveries.map((d) => (
        <DeliveryRow key={d.id} d={d} />
      ))}
    </div>
  );
}

function DeliveryRow({ d }: { d: Delivery }) {
  const [open, setOpen] = useState(false);
  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen((o) => !o);
    }
  };
  const tsForDisplay = d.last_attempt_at ?? d.created_at;
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
        <span style={{ width: 80, flexShrink: 0, opacity: 0.7 }}>
          {relativeTime(tsForDisplay)}
        </span>
        <span
          style={{
            width: 96,
            flexShrink: 0,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          #{d.event_id}
        </span>
        <span
          style={{ width: 70, flexShrink: 0 }}
          className="spec-cell-r"
        >
          {d.attempt_count}
        </span>
        <span style={{ width: 96, flexShrink: 0, marginLeft: 8 }}>
          <WebhookStatusPill status={d.status} />
        </span>
        <span
          style={{
            width: 60,
            flexShrink: 0,
            opacity: d.response_code && d.response_code >= 400 ? 1 : 0.7,
          }}
          className="spec-cell-r"
        >
          {d.response_code ?? "—"}
        </span>
        <span
          style={{
            flex: 1,
            minWidth: 0,
            opacity: 0.55,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={d.last_error ?? ""}
        >
          {d.last_error ? truncateMiddle(d.last_error, 40, 12) : "—"}
        </span>
      </button>

      {open && (
        <div className="spec-activity-detail">
          <div className="spec-activity-detail-grid">
            <span className="spec-activity-detail-label">Delivery ID</span>
            <span className="spec-activity-detail-value">
              <span style={{ fontVariantNumeric: "tabular-nums" }}>
                {d.delivery_id}
              </span>
            </span>

            <span className="spec-activity-detail-label">Event</span>
            <span className="spec-activity-detail-value">
              <span style={{ fontVariantNumeric: "tabular-nums" }}>
                #{d.event_id}
              </span>
            </span>

            <span className="spec-activity-detail-label">Status</span>
            <span className="spec-activity-detail-value">
              <WebhookStatusPill status={d.status} />
              <span style={{ opacity: 0.6 }}>· {d.status}</span>
            </span>

            <span className="spec-activity-detail-label">Attempts</span>
            <span className="spec-activity-detail-value">
              {d.attempt_count}
            </span>

            <span className="spec-activity-detail-label">Response code</span>
            <span className="spec-activity-detail-value">
              {d.response_code ?? <span style={{ opacity: 0.55 }}>—</span>}
            </span>

            {d.last_error && (
              <>
                <span className="spec-activity-detail-label">Last error</span>
                <span
                  className="spec-activity-detail-value"
                  style={{ wordBreak: "break-word" }}
                >
                  {d.last_error}
                </span>
              </>
            )}

            <span className="spec-activity-detail-label">Created</span>
            <span className="spec-activity-detail-value">
              <span style={{ fontVariantNumeric: "tabular-nums" }}>
                {d.created_at}
              </span>
              <span style={{ opacity: 0.6 }}>· {relativeTime(d.created_at)}</span>
            </span>

            {d.last_attempt_at && (
              <>
                <span className="spec-activity-detail-label">Last attempt</span>
                <span className="spec-activity-detail-value">
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>
                    {d.last_attempt_at}
                  </span>
                  <span style={{ opacity: 0.6 }}>
                    · {relativeTime(d.last_attempt_at)}
                  </span>
                </span>
              </>
            )}

            {d.delivered_at && (
              <>
                <span className="spec-activity-detail-label">Delivered</span>
                <span className="spec-activity-detail-value">
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>
                    {d.delivered_at}
                  </span>
                  <span style={{ opacity: 0.6 }}>
                    · {relativeTime(d.delivered_at)}
                  </span>
                </span>
              </>
            )}

            {d.next_retry_at && d.status === "retry" && (
              <>
                <span className="spec-activity-detail-label">Next retry</span>
                <span className="spec-activity-detail-value">
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>
                    {d.next_retry_at}
                  </span>
                  <span style={{ opacity: 0.6 }}>
                    · in {relativeTime(d.next_retry_at)}
                  </span>
                </span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SecretBanner({
  kind,
  value,
}: {
  kind: "signing_secret" | "rotated_secret";
  value: string;
}) {
  const [copied, setCopied] = useState(false);
  const headline =
    kind === "signing_secret"
      ? "New signing secret · shown once"
      : "Rotated signing secret · shown once";

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      style={{
        border: "1px solid #6080c0",
        background: "var(--color-bg-subtle)",
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "#6080c0",
        }}
      >
        {headline}
      </div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          color: "var(--color-text-primary)",
          wordBreak: "break-all",
          background: "var(--color-bg-base)",
          border: "1px solid var(--color-border-subtle)",
          padding: "8px 10px",
        }}
      >
        {value}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--color-text-quaternary)",
            letterSpacing: "0.04em",
          }}
        >
          we won't show this again — copy it now.
        </span>
        <button
          type="button"
          onClick={onCopy}
          style={{
            ...ACTION_BTN,
            borderColor: "#6080c0",
            color: "#6080c0",
          }}
        >
          {copied ? "copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
