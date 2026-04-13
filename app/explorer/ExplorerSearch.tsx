"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function ExplorerSearch() {
  const [query, setQuery] = useState("");
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    if (/^0x[a-fA-F0-9]{64}$/.test(q)) {
      router.push(`/explorer/tx/${q}`);
      return;
    }
    if (/^0x[a-fA-F0-9]{40}$/.test(q)) {
      router.push(`/explorer/address/${q}`);
      return;
    }
    if (/^\d+$/.test(q)) {
      router.push(`/explorer/block/${q}`);
      return;
    }
    router.push(`/explorer?q=${encodeURIComponent(q)}`);
  }

  return (
    <form onSubmit={handleSubmit} style={{ position: "relative", marginBottom: 28 }}>
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        style={{
          position: "absolute",
          left: 14,
          top: "50%",
          transform: "translateY(-50%)",
          color: "var(--color-text-quaternary)",
        }}
      >
        <circle cx="7" cy="7" r="5" />
        <line x1="11" y1="11" x2="14" y2="14" />
      </svg>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by address, token, tx hash, or block number..."
        style={{
          width: "100%",
          background: "rgba(255,255,255,0.03)",
          border: "1px solid var(--color-border-default)",
          borderRadius: 8,
          padding: "12px 16px 12px 40px",
          fontFamily: "var(--font-mono)",
          fontSize: 13,
          color: "var(--color-text-primary)",
          outline: "none",
        }}
      />
    </form>
  );
}
