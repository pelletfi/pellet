"use client";

import { useState } from "react";

export function ProCta() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes("@")) {
      setError("Valid email required.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const r = await fetch("/api/pro/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await r.json();
      if (!r.ok || !data.url) {
        setError(data.error ?? "Checkout failed. Try again.");
        setLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Network error. Try again.");
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 8 }}
    >
      <input
        type="email"
        required
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={loading}
        style={{
          padding: "10px 12px",
          borderRadius: 6,
          border: "1px solid var(--color-border-default)",
          background: "transparent",
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          color: "var(--color-text-primary)",
          outline: "none",
        }}
      />
      <button
        type="submit"
        disabled={loading}
        style={{
          padding: "10px 16px",
          borderRadius: 6,
          background: "var(--color-text-primary)",
          color: "var(--color-bg-base)",
          border: "none",
          fontSize: 13,
          fontWeight: 500,
          cursor: loading ? "wait" : "pointer",
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? "Redirecting…" : "Continue to checkout →"}
      </button>
      {error && (
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--color-text-tertiary)",
            marginTop: 4,
          }}
        >
          {error}
        </div>
      )}
    </form>
  );
}
