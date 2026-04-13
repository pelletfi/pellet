import Link from "next/link";
import type { StablecoinData } from "@/lib/types";

function formatSupply(raw: string, decimals = 6): string {
  const n = parseInt(raw, 10) / 10 ** decimals;
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function formatHeadroom(pct: number): string {
  if (pct === -1) return "uncapped";
  return `${pct.toFixed(1)}%`;
}

function pegDeviationColor(price: number): string {
  const dev = Math.abs(price - 1);
  if (dev < 0.001) return "#4ade80"; // <0.1% — tight peg
  if (dev < 0.005) return "#fbbf24"; // <0.5% — mild deviation
  return "#f87171";                   // ≥0.5% — notable deviation
}

interface StablecoinRowProps {
  token: StablecoinData;
}

export default function StablecoinRow({ token }: StablecoinRowProps) {
  const priceColor = pegDeviationColor(token.price_vs_pathusd);
  const devBps = Math.round(Math.abs(token.price_vs_pathusd - 1) * 10000);

  return (
    <Link
      href={`/stablecoins/${token.address}`}
      style={{
        display: "grid",
        gridTemplateColumns: "160px 90px 70px 110px 130px 90px 70px 80px",
        alignItems: "center",
        padding: "12px 16px",
        borderBottom: "1px solid #1a1a1f",
        textDecoration: "none",
        color: "inherit",
        transition: "background 0.1s",
        gap: "8px",
      }}
      className="hover:bg-[#13131a]"
    >
      {/* Symbol */}
      <span
        style={{
          fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
          fontSize: "14px",
          fontWeight: 500,
          color: "#e8e8e8",
        }}
      >
        {token.symbol}
      </span>

      {/* Price vs pathUSD */}
      <span
        style={{
          fontFamily: "var(--font-geist-mono), monospace",
          fontSize: "13px",
          color: priceColor,
        }}
      >
        {token.price_vs_pathusd.toFixed(6)}
      </span>

      {/* Spread bps */}
      <span
        style={{
          fontFamily: "var(--font-geist-mono), monospace",
          fontSize: "12px",
          color: "#888",
        }}
      >
        {token.spread_bps > 0 ? `${token.spread_bps} bps` : "—"}
      </span>

      {/* Policy type */}
      <span
        style={{
          fontFamily: "var(--font-geist-mono), monospace",
          fontSize: "12px",
          color: "#c4c4c4",
        }}
      >
        {token.policy_type || "none"}
      </span>

      {/* Supply */}
      <span
        style={{
          fontFamily: "var(--font-geist-mono), monospace",
          fontSize: "12px",
          color: "#c4c4c4",
          textAlign: "right",
        }}
      >
        {formatSupply(token.current_supply)}
      </span>

      {/* Headroom */}
      <span
        style={{
          fontFamily: "var(--font-geist-mono), monospace",
          fontSize: "12px",
          color: token.headroom_pct === -1 ? "#555" : "#c4c4c4",
        }}
      >
        {formatHeadroom(token.headroom_pct)}
      </span>

      {/* Currency */}
      <span
        style={{
          fontFamily: "var(--font-geist-mono), monospace",
          fontSize: "12px",
          color: "#555",
        }}
      >
        {token.currency}
      </span>

      {/* Yield */}
      <span
        style={{
          fontFamily: "var(--font-geist-mono), monospace",
          fontSize: "12px",
          color: token.yield_rate > 0 ? "#4ade80" : "#555",
          textAlign: "right",
        }}
      >
        {token.yield_rate > 0 ? `${(token.yield_rate * 100).toFixed(2)}%` : "—"}
      </span>
    </Link>
  );
}
