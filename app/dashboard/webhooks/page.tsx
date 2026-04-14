"use client";

import { useEffect, useState } from "react";

interface Subscription {
  id: string;
  label: string | null;
  url: string;
  event_types: string[];
  stable_filter: string[] | null;
  active: string;
  created_at: string;
  last_delivery_at: string | null;
}

const STABLES = [
  { addr: "0x20c0000000000000000000000000000000000000", symbol: "pathUSD" },
  { addr: "0x20c000000000000000000000b9537d11c60e8b50", symbol: "USDC.e" },
  { addr: "0x20c0000000000000000000001621e21f71cf12fb", symbol: "EURC.e" },
  { addr: "0x20c00000000000000000000014f22ca97301eb73", symbol: "USDT0" },
  { addr: "0x20c0000000000000000000003554d28269e0f3c2", symbol: "frxUSD" },
  { addr: "0x20c0000000000000000000000520792dcccccccc", symbol: "cUSD" },
  { addr: "0x20c0000000000000000000008ee4fcff88888888", symbol: "stcUSD" },
  { addr: "0x20c0000000000000000000007f7ba549dd0251b9", symbol: "rUSD" },
  { addr: "0x20c000000000000000000000aeed2ec36a54d0e5", symbol: "wsrUSD" },
  { addr: "0x20c0000000000000000000009a4a4b17e0dc6651", symbol: "EURAU" },
  { addr: "0x20c000000000000000000000383a23bacb546ab9", symbol: "reUSD" },
];

const EVENT_TYPES = [
  { id: "peg_break.started", label: "Peg break — started" },
  { id: "peg_break.ended", label: "Peg break — resolved" },
  { id: "flow_anomaly.detected", label: "Flow anomaly detected" },
  { id: "system.health_drift", label: "System health drift" },
];

export default function WebhooksDashboard() {
  const [key, setKey] = useState<string>("");
  const [submittedKey, setSubmittedKey] = useState<string>("");
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newSecret, setNewSecret] = useState<{ id: string; secret: string } | null>(null);

  // Form state
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [selectedStables, setSelectedStables] = useState<string[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem("pellet_admin_key");
    if (stored) {
      setKey(stored);
      setSubmittedKey(stored);
    }
  }, []);

  useEffect(() => {
    if (!submittedKey) return;
    setLoading(true);
    fetch("/api/admin/webhooks", { headers: { Authorization: `Bearer ${submittedKey}` } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status === 401 ? "invalid key" : `HTTP ${r.status}`))))
      .then((data) => {
        setSubs(data.subscriptions ?? []);
        setError(null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [submittedKey]);

  const submitKey = () => {
    localStorage.setItem("pellet_admin_key", key);
    setSubmittedKey(key);
  };

  const createSub = async () => {
    setError(null);
    setNewSecret(null);
    if (!url || selectedEvents.length === 0) {
      setError("URL and at least one event type required");
      return;
    }
    try {
      const r = await fetch("/api/admin/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${submittedKey}` },
        body: JSON.stringify({
          label: label || null,
          url,
          event_types: selectedEvents,
          stable_filter: selectedStables.length > 0 ? selectedStables : null,
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setNewSecret({ id: data.id, secret: data.secret });
      // Reset form + reload list
      setLabel("");
      setUrl("");
      setSelectedEvents([]);
      setSelectedStables([]);
      const list = await fetch("/api/admin/webhooks", { headers: { Authorization: `Bearer ${submittedKey}` } }).then((res) => res.json());
      setSubs(list.subscriptions ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  if (!submittedKey) {
    return (
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "80px 24px" }}>
        <h1 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 32, marginBottom: 8 }}>Webhooks</h1>
        <p style={{ fontSize: 14, color: "var(--color-text-tertiary)", marginBottom: 24 }}>
          Enter your Pellet admin key to manage webhook subscriptions.
        </p>
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submitKey()}
          placeholder="pk_..."
          style={{
            width: "100%",
            padding: "10px 12px",
            background: "transparent",
            border: "1px solid var(--color-border-subtle)",
            borderRadius: 6,
            color: "var(--color-text-primary)",
            fontFamily: "var(--font-mono)",
            fontSize: 13,
            marginBottom: 12,
          }}
        />
        <button
          onClick={submitKey}
          style={{
            width: "100%",
            padding: "10px 16px",
            background: "var(--color-text-primary)",
            color: "var(--color-bg-base)",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            fontWeight: 500,
            fontSize: 13,
          }}
        >
          Continue
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "60px 24px 80px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 32 }}>
        <h1 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 32, fontWeight: 400, margin: 0 }}>Webhooks</h1>
        <button
          onClick={() => {
            localStorage.removeItem("pellet_admin_key");
            setSubmittedKey("");
            setKey("");
          }}
          style={{
            background: "transparent",
            border: "1px solid var(--color-border-subtle)",
            color: "var(--color-text-tertiary)",
            padding: "4px 10px",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 11,
            fontFamily: "var(--font-mono)",
          }}
        >
          sign out
        </button>
      </div>

      {error && (
        <div style={{ padding: 12, marginBottom: 16, background: "rgba(229,72,77,0.06)", border: "1px solid rgba(229,72,77,0.3)", borderRadius: 6, color: "var(--color-text-secondary)", fontSize: 13, fontFamily: "var(--font-mono)" }}>
          {error}
        </div>
      )}

      {newSecret && (
        <div style={{ padding: 16, marginBottom: 24, background: "rgba(255,255,255,0.03)", border: "1px solid var(--color-border-subtle)", borderRadius: 8 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-text-quaternary)", marginBottom: 8 }}>
            Save this secret — only shown once
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--color-text-primary)", wordBreak: "break-all" }}>
            <strong>id:</strong> {newSecret.id}<br />
            <strong>secret:</strong> {newSecret.secret}
          </div>
        </div>
      )}

      <h2 style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-text-quaternary)", marginBottom: 12 }}>
        Create subscription
      </h2>
      <div style={{ padding: 20, border: "1px solid var(--color-border-subtle)", borderRadius: 8, marginBottom: 32, display: "flex", flexDirection: "column", gap: 14 }}>
        <FormField label="Label (optional)">
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Slack alerts" style={inputStyle} />
        </FormField>
        <FormField label="Endpoint URL">
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://your-app.com/webhooks/pellet" style={inputStyle} />
        </FormField>
        <FormField label="Event types">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {EVENT_TYPES.map((e) => (
              <Pill
                key={e.id}
                label={e.label}
                selected={selectedEvents.includes(e.id)}
                onClick={() => setSelectedEvents((prev) => prev.includes(e.id) ? prev.filter((x) => x !== e.id) : [...prev, e.id])}
              />
            ))}
          </div>
        </FormField>
        <FormField label="Stable filter (optional — empty = all stables)">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {STABLES.map((s) => (
              <Pill
                key={s.addr}
                label={s.symbol}
                selected={selectedStables.includes(s.addr)}
                onClick={() => setSelectedStables((prev) => prev.includes(s.addr) ? prev.filter((x) => x !== s.addr) : [...prev, s.addr])}
              />
            ))}
          </div>
        </FormField>
        <button
          onClick={createSub}
          style={{
            alignSelf: "flex-start",
            padding: "8px 16px",
            background: "var(--color-text-primary)",
            color: "var(--color-bg-base)",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
            fontWeight: 500,
            fontSize: 12,
            marginTop: 4,
          }}
        >
          Create
        </button>
      </div>

      <h2 style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-text-quaternary)", marginBottom: 12 }}>
        Active subscriptions {subs.length > 0 && `(${subs.length})`}
      </h2>
      {loading ? (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-text-quaternary)", padding: 16 }}>Loading…</div>
      ) : subs.length === 0 ? (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--color-text-quaternary)", padding: 24, border: "1px solid var(--color-border-subtle)", borderRadius: 8, textAlign: "center" }}>
          No subscriptions yet
        </div>
      ) : (
        <div style={{ border: "1px solid var(--color-border-subtle)", borderRadius: 8, overflow: "hidden" }}>
          {subs.map((s, i) => (
            <div key={s.id} style={{ padding: 16, borderTop: i === 0 ? "none" : "1px solid var(--color-border-subtle)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <div style={{ fontSize: 13, color: "var(--color-text-primary)", fontWeight: 500 }}>{s.label || s.id}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--color-text-quaternary)" }}>{s.id}</div>
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-text-tertiary)", wordBreak: "break-all", marginBottom: 6 }}>{s.url}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, fontFamily: "var(--font-mono)", fontSize: 10 }}>
                {s.event_types.map((e) => (
                  <span key={e} style={{ padding: "1px 6px", border: "1px solid var(--color-border-subtle)", borderRadius: 3, color: "var(--color-text-tertiary)" }}>{e}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  background: "transparent",
  border: "1px solid var(--color-border-subtle)",
  borderRadius: 6,
  color: "var(--color-text-primary)",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
};

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--color-text-quaternary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

function Pill({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "5px 10px",
        background: selected ? "rgba(255,255,255,0.08)" : "transparent",
        border: selected ? "1px solid var(--color-border-default)" : "1px solid var(--color-border-subtle)",
        borderRadius: 4,
        color: selected ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
        cursor: "pointer",
        fontFamily: "var(--font-mono)",
        fontSize: 11,
      }}
    >
      {label}
    </button>
  );
}
