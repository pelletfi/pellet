"use client";

import { useState } from "react";

export function Copyable({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="pltn-foot-copy"
      data-copied={copied ? 1 : 0}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        } catch {}
      }}
      aria-label={`Copy ${value}`}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
