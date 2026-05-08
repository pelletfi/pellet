"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type AgentChoice = { id: string; label: string };

const FIELD_STYLE: React.CSSProperties = {
  width: "100%",
  background: "transparent",
  border: "1px solid var(--color-border-default)",
  color: "var(--color-text-primary)",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  padding: "8px 10px",
  outline: "none",
};

const LABEL_STYLE: React.CSSProperties = {
  display: "block",
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "var(--color-text-quaternary)",
  marginBottom: 6,
};

const HINT_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  color: "var(--color-text-quaternary)",
  marginTop: 4,
  letterSpacing: "0.04em",
};

export function NewWebhookForm({ agents }: { agents: AgentChoice[] }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const fd = new FormData(e.currentTarget);
    const callback_url = String(fd.get("callback_url") ?? "").trim();
    const label = String(fd.get("label") ?? "").trim() || null;
    const agent_id = String(fd.get("agent_id") ?? "").trim();
    const recipient_address = String(fd.get("recipient_address") ?? "").trim();
    const routed_to_address = String(fd.get("routed_to_address") ?? "").trim();
    const min_amount_wei = String(fd.get("min_amount_wei") ?? "").trim();
    const token_address = String(fd.get("token_address") ?? "").trim();

    if (!callback_url) {
      setError("Callback URL is required.");
      setSubmitting(false);
      return;
    }
    if (!agent_id) {
      setError("Agent is required.");
      setSubmitting(false);
      return;
    }

    const filters: Record<string, string> = { agent_id };
    if (recipient_address) filters.recipient_address = recipient_address;
    if (routed_to_address) filters.routed_to_address = routed_to_address;
    if (min_amount_wei) filters.min_amount_wei = min_amount_wei;
    if (token_address) filters.token_address = token_address;

    try {
      const res = await fetch("/api/webhooks", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ callback_url, label, filters }),
      });
      if (!res.ok) {
        let detail = "";
        try {
          const j = (await res.json()) as { error?: string; detail?: string };
          detail = j.detail ?? j.error ?? "";
        } catch {
          /* ignore */
        }
        setError(detail || `request failed (${res.status})`);
        setSubmitting(false);
        return;
      }
      const data = (await res.json()) as {
        id: string;
        signing_secret?: string;
      };
      const qs = data.signing_secret
        ? `?secret=${encodeURIComponent(data.signing_secret)}`
        : "";
      router.push(`/webhooks/${data.id}${qs}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "network error");
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        border: "1px solid var(--color-border-subtle)",
        background: "var(--color-bg-subtle)",
        padding: 24,
      }}
    >
      <Field label="Agent" required>
        <select
          name="agent_id"
          required
          defaultValue=""
          style={{ ...FIELD_STYLE, appearance: "none", cursor: "pointer" }}
        >
          <option value="" disabled>
            choose an agent…
          </option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label} ({a.id})
            </option>
          ))}
        </select>
      </Field>

      <Field label="Callback URL" required>
        <input
          type="url"
          name="callback_url"
          required
          inputMode="url"
          placeholder="https://example.com/hooks/pellet"
          style={FIELD_STYLE}
        />
        <span style={HINT_STYLE}>
          we POST signed JSON here. respond 2xx within 5s.
        </span>
      </Field>

      <Field label="Label">
        <input
          type="text"
          name="label"
          maxLength={64}
          placeholder="e.g. prod ingest"
          style={FIELD_STYLE}
        />
        <span style={HINT_STYLE}>optional — for your reference only.</span>
      </Field>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
        }}
      >
        <Field label="Recipient address">
          <input
            type="text"
            name="recipient_address"
            placeholder="0x…"
            style={FIELD_STYLE}
          />
        </Field>
        <Field label="Routed-to address">
          <input
            type="text"
            name="routed_to_address"
            placeholder="0x…"
            style={FIELD_STYLE}
          />
        </Field>
        <Field label="Token address">
          <input
            type="text"
            name="token_address"
            placeholder="0x…"
            style={FIELD_STYLE}
          />
        </Field>
        <Field label="Min amount (wei)">
          <input
            type="text"
            name="min_amount_wei"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="0"
            style={FIELD_STYLE}
          />
        </Field>
      </div>

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

      <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
        <button
          type="submit"
          disabled={submitting}
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            border: "1px solid var(--color-border-default)",
            padding: "8px 14px",
            color: "var(--color-text-primary)",
            background: "transparent",
            cursor: submitting ? "wait" : "pointer",
            opacity: submitting ? 0.6 : 1,
          }}
        >
          {submitting ? "creating…" : "Create subscription"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label style={LABEL_STYLE}>
        {label}
        {required && <span style={{ color: "var(--color-error)", marginLeft: 4 }}>*</span>}
      </label>
      {children}
    </div>
  );
}
