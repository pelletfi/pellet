"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import type { StablecoinData } from "@/lib/types";
import { getTokenIconUrl } from "@/lib/token-icons";

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
  if (dev < 0.001) return "var(--color-positive)"; // <0.1% — tight peg
  if (dev < 0.005) return "#d97706";               // <0.5% — mild deviation
  return "var(--color-negative)";                    // ≥0.5% — notable deviation
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
      className="stablecoin-table-row hover:bg-[var(--color-surface)]"
      style={{
        display: "grid",
        gridTemplateColumns: "160px 90px 70px 110px 130px 90px 70px 80px",
        alignItems: "center",
        padding: "12px 16px",
        borderBottom: "1px solid var(--color-border)",
        textDecoration: "none",
        color: "inherit",
        transition: "background 0.1s",
        gap: "8px",
      }}
    >
      {/* Symbol + icon */}
      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontFamily: "var(--font-mono), monospace",
          fontSize: "14px",
          fontWeight: 500,
          color: "var(--color-text)",
        }}
      >
        <img
          src={getTokenIconUrl(token.address)}
          alt=""
          width={20}
          height={20}
          style={{ borderRadius: "50%", flexShrink: 0 }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
        {token.symbol}
      </span>

      {/* Price vs pathUSD */}
      <span
        style={{
          fontFamily: "var(--font-mono), monospace",
          fontSize: "13px",
          color: priceColor,
        }}
      >
        {token.price_vs_pathusd.toFixed(6)}
      </span>

      {/* Spread bps */}
      <span
        style={{
          fontFamily: "var(--font-mono), monospace",
          fontSize: "12px",
          color: "var(--color-muted)",
        }}
      >
        {token.spread_bps > 0 ? `${token.spread_bps} bps` : "—"}
      </span>

      {/* Policy type */}
      <span
        className="hide-mobile"
        style={{
          fontFamily: "var(--font-mono), monospace",
          fontSize: "12px",
          color: "var(--color-secondary)",
        }}
      >
        {token.policy_type || "none"}
      </span>

      {/* Supply */}
      <span
        className="hide-mobile"
        style={{
          fontFamily: "var(--font-mono), monospace",
          fontSize: "12px",
          color: "var(--color-secondary)",
          textAlign: "right",
        }}
      >
        {formatSupply(token.current_supply)}
      </span>

      {/* Headroom */}
      <span
        className="hide-mobile"
        style={{
          fontFamily: "var(--font-mono), monospace",
          fontSize: "12px",
          color: token.headroom_pct === -1 ? "var(--color-muted)" : "var(--color-secondary)",
        }}
      >
        {formatHeadroom(token.headroom_pct)}
      </span>

      {/* Currency */}
      <span
        className="hide-mobile"
        style={{
          fontFamily: "var(--font-mono), monospace",
          fontSize: "12px",
          color: "var(--color-muted)",
        }}
      >
        {token.currency}
      </span>

      {/* Yield */}
      <span
        className="hide-mobile"
        style={{
          fontFamily: "var(--font-mono), monospace",
          fontSize: "12px",
          color: token.yield_rate > 0 ? "var(--color-positive)" : "var(--color-muted)",
          textAlign: "right",
        }}
      >
        {token.yield_rate > 0 ? `${(token.yield_rate * 100).toFixed(2)}%` : "—"}
      </span>
    </Link>
  );
}
