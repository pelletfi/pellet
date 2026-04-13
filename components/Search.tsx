"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function Search({ defaultValue = "" }: { defaultValue?: string }) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = value.trim();
    if (!q) return;

    if (/^0x[0-9a-fA-F]{40}$/.test(q)) {
      router.push(`/token/${q}`);
    } else {
      router.push(`/tokens?q=${encodeURIComponent(q)}`);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", gap: "8px" }}>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search token name or paste address…"
        style={{
          flex: 1,
          padding: "9px 14px",
          background: "#fff",
          border: "1px solid var(--color-border)",
          borderRadius: "6px",
          color: "var(--color-text)",
          fontFamily: "var(--font-inter), system-ui, sans-serif",
          fontSize: "14px",
          outline: "none",
          transition: "border-color 0.15s",
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = "var(--color-muted)";
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = "var(--color-border)";
        }}
      />
      <button
        type="submit"
        style={{
          padding: "9px 18px",
          background: "var(--color-text)",
          border: "none",
          borderRadius: "6px",
          color: "#fff",
          fontFamily: "var(--font-inter), system-ui, sans-serif",
          fontSize: "13px",
          fontWeight: 600,
          cursor: "pointer",
          transition: "opacity 0.15s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
      >
        Search
      </button>
    </form>
  );
}
