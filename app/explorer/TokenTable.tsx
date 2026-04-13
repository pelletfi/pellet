"use client";

import { useState, useEffect } from "react";
import StablecoinRow from "@/components/StablecoinRow";
import type { StablecoinData } from "@/lib/types";

interface StablecoinsTableProps {
  stablecoins?: StablecoinData[];
}

export default function StablecoinsTable({ stablecoins: initial }: StablecoinsTableProps) {
  const [stablecoins, setStablecoins] = useState<StablecoinData[]>(initial ?? []);
  const [loading, setLoading] = useState(!initial);

  // Fetch stablecoins client-side if none were passed in
  useEffect(() => {
    if (initial && initial.length > 0) return;
    setLoading(true);
    fetch("/api/v1/stablecoins")
      .then((r) => r.json())
      .then((d) => setStablecoins(d.stablecoins ?? []))
      .catch(() => setStablecoins([]))
      .finally(() => setLoading(false));
  }, [initial]);

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          height: 40,
          borderBottom: "1px solid var(--color-border-subtle)",
          marginBottom: 16,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            fontWeight: 500,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "var(--color-text-secondary)",
          }}
        >
          Stablecoins
        </span>
      </div>

      {/* Table */}
      <div className="data-table">
        <div
          className="stablecoin-table-header"
          style={{
            alignItems: "center",
            height: 32,
            padding: "0 16px",
            borderBottom: "1px solid var(--color-border-default)",
          }}
        >
          {[
            "Symbol",
            "Price",
            "Spread",
            "Policy",
            "Supply",
            "Headroom",
            "Currency",
            "Yield",
          ].map((label, i) => (
            <span
              key={label}
              className={i >= 3 ? "hide-mobile" : undefined}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                fontWeight: 500,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                color: "var(--color-text-quaternary)",
                textAlign:
                  label === "Supply" || label === "Yield" ? "right" : "left",
              }}
            >
              {label}
            </span>
          ))}
        </div>

        {loading ? (
          <div
            style={{
              padding: "48px 16px",
              textAlign: "center",
              fontSize: 13,
              color: "var(--color-text-tertiary)",
            }}
          >
            Loading stablecoins...
          </div>
        ) : stablecoins.length === 0 ? (
          <div
            style={{
              padding: "48px 16px",
              textAlign: "center",
              fontSize: 13,
              color: "var(--color-text-tertiary)",
            }}
          >
            No stablecoins found.
          </div>
        ) : (
          stablecoins.map((s) => <StablecoinRow key={s.address} token={s} />)
        )}
      </div>
    </div>
  );
}
