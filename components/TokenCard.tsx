import Link from "next/link";
import type { GeckoPool } from "@/lib/gecko";

function formatUsd(value: number): string {
  if (value === 0) return "$0";
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  if (abs >= 1) return `$${value.toFixed(4)}`;
  // Small numbers: show up to 8 sig figs
  return `$${value.toPrecision(4)}`;
}

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

interface TokenCardProps {
  pool: GeckoPool;
}

export default function TokenCard({ pool }: TokenCardProps) {
  const attrs = pool.attributes;
  const baseTokenId = pool.relationships?.base_token?.data?.id ?? "";
  // GeckoTerminal token IDs are "network_address"
  const address = baseTokenId.includes("_") ? baseTokenId.split("_")[1] : baseTokenId;

  const price = parseFloat(attrs.base_token_price_usd ?? "0");
  const volume = parseFloat(attrs.volume_usd?.h24 ?? "0");
  const reserve = parseFloat(attrs.reserve_in_usd ?? "0");
  const priceChange = parseFloat(attrs.price_change_percentage?.h24 ?? "0");

  const poolName = attrs.name ?? "";
  // Pool name is often "TOKEN / QUOTE" — extract token name
  const tokenName = poolName.split(" / ")[0] ?? poolName;

  return (
    <Link
      href={`/token/${address}`}
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 140px 120px 120px",
        alignItems: "center",
        padding: "12px 16px",
        borderBottom: "1px solid #1a1a1f",
        textDecoration: "none",
        color: "inherit",
        transition: "background 0.1s",
      }}
      className="hover:bg-[#13131a]"
    >
      {/* Token name + address */}
      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        <span
          style={{
            fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
            fontSize: "14px",
            fontWeight: 500,
            color: "#e8e8e8",
          }}
        >
          {tokenName}
        </span>
        {address && (
          <span
            style={{
              fontFamily: "var(--font-geist-mono), monospace",
              fontSize: "11px",
              color: "#555",
            }}
          >
            {truncateAddress(address)}
          </span>
        )}
      </div>

      {/* Price + 24h change */}
      <div style={{ display: "flex", flexDirection: "column", gap: "2px", textAlign: "right" }}>
        <span
          style={{
            fontFamily: "var(--font-geist-mono), monospace",
            fontSize: "13px",
            color: "#e8e8e8",
          }}
        >
          {price > 0 ? formatUsd(price) : "—"}
        </span>
        {attrs.price_change_percentage?.h24 && (
          <span
            style={{
              fontFamily: "var(--font-geist-mono), monospace",
              fontSize: "11px",
              color: priceChange >= 0 ? "#4ade80" : "#f87171",
            }}
          >
            {priceChange >= 0 ? "+" : ""}
            {priceChange.toFixed(2)}%
          </span>
        )}
      </div>

      {/* Volume 24h */}
      <div style={{ textAlign: "right" }}>
        <span
          style={{
            fontFamily: "var(--font-geist-mono), monospace",
            fontSize: "13px",
            color: "#c4c4c4",
          }}
        >
          {volume > 0 ? formatUsd(volume) : "—"}
        </span>
      </div>

      {/* Liquidity */}
      <div style={{ textAlign: "right" }}>
        <span
          style={{
            fontFamily: "var(--font-geist-mono), monospace",
            fontSize: "13px",
            color: "#c4c4c4",
          }}
        >
          {reserve > 0 ? formatUsd(reserve) : "—"}
        </span>
      </div>
    </Link>
  );
}
