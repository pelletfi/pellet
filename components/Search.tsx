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

    // If it looks like a hex address, go directly to token detail
    if (/^0x[0-9a-fA-F]{40}$/.test(q)) {
      router.push(`/token/${q}`);
    } else {
      router.push(`/?q=${encodeURIComponent(q)}`);
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
          background: "#13131a",
          border: "1px solid #1a1a1f",
          borderRadius: "8px",
          color: "#e8e8e8",
          fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
          fontSize: "14px",
          outline: "none",
          transition: "border-color 0.15s",
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = "#333340";
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = "#1a1a1f";
        }}
      />
      <button
        type="submit"
        style={{
          padding: "9px 18px",
          background: "#4ade80",
          border: "none",
          borderRadius: "8px",
          color: "#0f0f11",
          fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
          fontSize: "14px",
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
