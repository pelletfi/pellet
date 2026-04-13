"use client";

import Link from "next/link";

function formatUsd(value: number): string {
  if (value === 0) return "$0";
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  if (abs >= 1) return `$${value.toFixed(4)}`;
  return `$${value.toPrecision(4)}`;
}

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export interface TokenCardProps {
  address: string;
  name: string;
  imageUrl?: string | null;
  priceUsd: number;
  priceChange24h: number;
  volume24h: number;
  liquidity: number;
}

export default function TokenCard({
  address,
  name,
  imageUrl,
  priceUsd,
  priceChange24h,
  volume24h,
  liquidity,
}: TokenCardProps) {
  return (
    <Link
      href={`/token/${address}`}
      className="token-table-row"
      style={{
        alignItems: "center",
        padding: "12px 16px",
        borderBottom: "1px solid #f5f5f5",
        textDecoration: "none",
        color: "inherit",
        transition: "background 0.1s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--color-surface)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      {/* Token: icon + name + address */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            width={28}
            height={28}
            style={{ borderRadius: "50%", flexShrink: 0 }}
          />
        ) : (
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: "var(--color-border)",
              flexShrink: 0,
            }}
          />
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: "1px", minWidth: 0 }}>
          <span
            style={{
              fontFamily: "var(--font-inter), system-ui, sans-serif",
              fontSize: "14px",
              fontWeight: 500,
              color: "var(--color-text)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {name}
          </span>
          {address && (
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                color: "var(--color-muted)",
              }}
            >
              {truncateAddress(address)}
            </span>
          )}
        </div>
      </div>

      {/* Price + change */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1px", textAlign: "right" }}>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "13px",
            color: "var(--color-text)",
          }}
        >
          {priceUsd > 0 ? formatUsd(priceUsd) : "—"}
        </span>
        {priceChange24h !== 0 && (
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              color: priceChange24h >= 0 ? "var(--color-positive)" : "var(--color-negative)",
            }}
          >
            {priceChange24h >= 0 ? "+" : ""}
            {priceChange24h.toFixed(2)}%
          </span>
        )}
      </div>

      {/* Volume 24h */}
      <div className="hide-mobile" style={{ textAlign: "right" }}>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "13px",
            color: "var(--color-secondary)",
          }}
        >
          {volume24h > 0 ? formatUsd(volume24h) : "—"}
        </span>
      </div>

      {/* Liquidity */}
      <div className="hide-mobile" style={{ textAlign: "right" }}>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "13px",
            color: "var(--color-secondary)",
          }}
        >
          {liquidity > 0 ? formatUsd(liquidity) : "—"}
        </span>
      </div>
    </Link>
  );
}
