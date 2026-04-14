"use client";

import { useState } from "react";

export function CopyKey({ apiKey }: { apiKey: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable — fall through silently
    }
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "14px 16px",
        border: "1px solid var(--color-border-subtle)",
        borderRadius: 6,
        background: "var(--color-bg-subtle, rgba(255,255,255,0.02))",
      }}
    >
      <code
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 13,
          color: "var(--color-text-primary)",
          flex: 1,
          overflow: "auto",
          whiteSpace: "nowrap",
        }}
      >
        {apiKey}
      </code>
      <button
        onClick={copy}
        style={{
          padding: "6px 12px",
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "var(--color-text-primary)",
          background: "transparent",
          border: "1px solid var(--color-border-subtle)",
          borderRadius: 4,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
