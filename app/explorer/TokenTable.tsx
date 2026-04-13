"use client";

import { useState, useEffect } from "react";
import TokenCard from "@/components/TokenCard";
import StablecoinRow from "@/components/StablecoinRow";
import type { StablecoinData } from "@/lib/types";

interface TokenTableProps {
  tokens: Array<{
    address: string;
    name: string;
    imageUrl: string | null;
    priceUsd: number;
    priceChange24h: number;
    volume24h: number;
    liquidity: number;
  }>;
}

type Tab = "tokens" | "stablecoins" | "txns";

const TAB_STYLE: React.CSSProperties = {
  padding: "8px 16px",
  fontSize: 13,
  fontWeight: 500,
  color: "var(--color-text-quaternary)",
  background: "none",
  border: "none",
  cursor: "pointer",
  borderBottom: "2px solid transparent",
  marginBottom: -1,
  fontFamily: "var(--font-sans)",
  transition: "color 150ms ease, border-color 150ms ease",
};

const TAB_ACTIVE_STYLE: React.CSSProperties = {
  ...TAB_STYLE,
  color: "var(--color-text-primary)",
  borderBottomColor: "var(--color-text-primary)",
};

export default function TokenTable({ tokens }: TokenTableProps) {
  const [tab, setTab] = useState<Tab>("tokens");
  const [stablecoins, setStablecoins] = useState<StablecoinData[]>([]);
  const [stableLoading, setStableLoading] = useState(false);
  const [stableFetched, setStableFetched] = useState(false);

  // Fetch stablecoins when that tab is first selected
  useEffect(() => {
    if (tab !== "stablecoins" || stableFetched) return;
    setStableLoading(true);
    fetch("/api/v1/stablecoins")
      .then((r) => r.json())
      .then((d) => setStablecoins(d.stablecoins ?? []))
      .catch(() => setStablecoins([]))
      .finally(() => {
        setStableLoading(false);
        setStableFetched(true);
      });
  }, [tab, stableFetched]);

  return (
    <div>
      {/* Tabs */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid var(--color-border-subtle)",
          marginBottom: 16,
        }}
      >
        {(
          [
            ["tokens", "Tokens"],
            ["stablecoins", "Stablecoins"],
            ["txns", "Recent Txns"],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={tab === key ? TAB_ACTIVE_STYLE : TAB_STYLE}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "tokens" && (
        <div className="data-table">
          <div
            className="table-header-row"
            style={{ gridTemplateColumns: "2.5fr 1fr 1fr 1fr" }}
          >
            {["Token", "Price", "Volume 24H", "Liquidity"].map((label) => (
              <span
                key={label}
                className={
                  label === "Volume 24H" || label === "Liquidity"
                    ? "hide-mobile"
                    : undefined
                }
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  fontWeight: 500,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  color: "var(--color-text-quaternary)",
                  textAlign: label === "Token" ? "left" : "right",
                }}
              >
                {label}
              </span>
            ))}
          </div>

          {tokens.length === 0 ? (
            <div
              style={{
                padding: "48px 16px",
                textAlign: "center",
                fontSize: 14,
                color: "var(--color-text-tertiary)",
              }}
            >
              No tokens available.
            </div>
          ) : (
            tokens.map((t) => (
              <TokenCard
                key={t.address}
                address={t.address}
                name={t.name}
                imageUrl={t.imageUrl}
                priceUsd={t.priceUsd}
                priceChange24h={t.priceChange24h}
                volume24h={t.volume24h}
                liquidity={t.liquidity}
              />
            ))
          )}
        </div>
      )}

      {tab === "stablecoins" && (
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

          {stableLoading ? (
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
            stablecoins.map((s) => (
              <StablecoinRow key={s.address} token={s} />
            ))
          )}
        </div>
      )}

      {tab === "txns" && (
        <div className="data-table">
          <div
            style={{
              padding: "48px 16px",
              textAlign: "center",
              fontSize: 13,
              color: "var(--color-text-tertiary)",
            }}
          >
            Real-time transaction indexing coming soon
          </div>
        </div>
      )}
    </div>
  );
}
