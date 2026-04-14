"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import type { StablecoinData } from "@/lib/types";

interface SupplyDistributionProps {
  stablecoins: StablecoinData[];
}

function formatCompact(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  if (n > 0) return `$${n.toFixed(0)}`;
  return "$0";
}

function parseSupply(raw: string, decimals = 6): number {
  const n = parseInt(raw, 10) / 10 ** decimals;
  return isFinite(n) ? n : 0;
}

export function SupplyDistribution({ stablecoins }: SupplyDistributionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });

  // Parse supplies and sort
  const entries = stablecoins
    .map((s) => ({
      symbol: s.symbol,
      supply: parseSupply(s.current_supply ?? "0", 6),
    }))
    .filter((e) => e.supply > 0)
    .sort((a, b) => b.supply - a.supply);

  const total = entries.reduce((sum, e) => sum + e.supply, 0);
  if (total === 0 || entries.length === 0) return null;

  // Take up to 5, aggregate rest as "Other"
  const top = entries.slice(0, 5);
  const rest = entries.slice(5);
  if (rest.length > 0) {
    const otherSum = rest.reduce((sum, e) => sum + e.supply, 0);
    if (otherSum > 0) top.push({ symbol: `+${rest.length} more`, supply: otherSum });
  }

  const maxSupply = top[0].supply;
  const minSupply = top[top.length - 1].supply;
  const range = maxSupply - minSupply || 1;

  function bgOpacity(supply: number): number {
    return 0.025 + ((supply - minSupply) / range) * (0.06 - 0.025);
  }

  return (
    <div
      ref={ref}
      style={{
        border: "1px solid var(--color-border-subtle)",
        borderRadius: 8,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          padding: "10px 14px",
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          fontWeight: 500,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--color-text-quaternary)",
        }}
      >
        SUPPLY DISTRIBUTION
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gridTemplateRows: "1fr 1fr",
          gap: 2,
          flex: 1,
          minHeight: 150,
          padding: "0 2px 2px",
        }}
      >
        {top.slice(0, 6).map((entry, i) => {
          const pct = ((entry.supply / total) * 100).toFixed(1);
          const opacity = bgOpacity(entry.supply);

          return (
            <motion.div
              key={entry.symbol}
              initial={{ opacity: 0, y: 8 }}
              animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
              transition={{
                duration: 0.4,
                delay: i * 0.06,
                ease: [0.16, 1, 0.3, 1] as const,
              }}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                background: `rgba(255,255,255,${opacity})`,
                borderRadius: 4,
                cursor: "default",
                transition: "background 150ms ease, border-color 150ms ease",
                border: "1px solid transparent",
                ...(i === 0 ? { gridRow: "span 2" } : {}),
              }}
              whileHover={{
                background: "rgba(255,255,255,0.08)",
                borderColor: "var(--color-border-default)",
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 15,
                  fontWeight: 600,
                  color: "var(--color-text-primary)",
                  lineHeight: 1.2,
                }}
              >
                {pct}%
              </div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  fontWeight: 500,
                  color: "var(--color-text-secondary)",
                  marginTop: 3,
                }}
              >
                {entry.symbol}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 9,
                  color: "var(--color-text-quaternary)",
                  marginTop: 1,
                }}
              >
                {formatCompact(entry.supply)}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
