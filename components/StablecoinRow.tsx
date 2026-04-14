"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import type { StablecoinData } from "@/lib/types";
import { getTokenIconUrlSync } from "@/lib/token-icons";

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

interface StablecoinRowProps {
  token: StablecoinData;
}

export default function StablecoinRow({ token }: StablecoinRowProps) {

  return (
    <Link
      href={`/explorer/stablecoin/${token.address}`}
      className="stablecoin-table-row"
      style={{
        display: "grid",
        gridTemplateColumns: "160px 90px 70px 110px 130px 90px 70px 80px",
        alignItems: "center",
        padding: "12px 16px",
        borderBottom: "1px solid var(--color-border-subtle)",
        textDecoration: "none",
        color: "inherit",
        transition: "background 0.1s",
        gap: "8px",
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
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
          color: "var(--color-text-primary)",
        }}
      >
        <img
          src={getTokenIconUrlSync(token.address)}
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
          color: "var(--color-text-primary)",
        }}
      >
        {token.price_vs_pathusd.toFixed(6)}
      </span>

      {/* Spread bps */}
      <span
        style={{
          fontFamily: "var(--font-mono), monospace",
          fontSize: "12px",
          color: "var(--color-text-tertiary)",
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
          color: "var(--color-text-secondary)",
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
          color: "var(--color-text-secondary)",
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
          color: token.headroom_pct === -1 ? "var(--color-text-tertiary)" : "var(--color-text-secondary)",
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
          color: "var(--color-text-tertiary)",
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
          color: token.yield_rate > 0 ? "var(--color-text-secondary)" : "var(--color-text-tertiary)",
          textAlign: "right",
        }}
      >
        {token.yield_rate > 0 ? `${(token.yield_rate * 100).toFixed(2)}%` : "—"}
      </span>
    </Link>
  );
}
