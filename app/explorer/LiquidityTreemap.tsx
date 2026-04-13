"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";

interface Token {
  name: string;
  liquidity: number;
}

interface LiquidityTreemapProps {
  tokens: Token[];
}

function formatCompactUsd(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  if (n > 0) return `$${n.toFixed(0)}`;
  return "$0";
}

export function LiquidityTreemap({ tokens }: LiquidityTreemapProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });

  const total = tokens.reduce((sum, t) => sum + t.liquidity, 0);
  if (total === 0) return null;

  // Take up to 5 tokens, sorted by liquidity descending
  const sorted = [...tokens]
    .sort((a, b) => b.liquidity - a.liquidity)
    .slice(0, 5);

  // Opacity scales: largest -> 0.06, smallest -> 0.025
  const opacityMin = 0.025;
  const opacityMax = 0.06;
  const maxLiq = sorted[0]?.liquidity ?? 1;
  const minLiq = sorted[sorted.length - 1]?.liquidity ?? 0;
  const liqRange = maxLiq - minLiq || 1;

  function bgOpacity(liquidity: number): number {
    return opacityMin + ((liquidity - minLiq) / liqRange) * (opacityMax - opacityMin);
  }

  return (
    <div
      ref={ref}
      style={{
        border: "1px solid var(--color-border-subtle)",
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      {/* Header */}
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
        LIQUIDITY DISTRIBUTION
      </div>

      {/* Treemap grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gridTemplateRows: "1fr 1fr",
          gap: 2,
          height: 200,
          padding: "0 2px 2px",
        }}
      >
        {sorted.map((token, i) => {
          const pct = ((token.liquidity / total) * 100).toFixed(1);
          const opacity = bgOpacity(token.liquidity);

          return (
            <motion.div
              key={token.name}
              initial={{ opacity: 0, y: 8 }}
              animate={
                inView
                  ? { opacity: 1, y: 0 }
                  : { opacity: 0, y: 8 }
              }
              transition={{
                duration: 0.4,
                delay: i * 0.06,
                ease: [0.16, 1, 0.3, 1],
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
              {/* Percentage */}
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 18,
                  fontWeight: 600,
                  color: "var(--color-text-primary)",
                  lineHeight: 1.2,
                }}
              >
                {pct}%
              </div>
              {/* Token name */}
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  fontWeight: 500,
                  color: "var(--color-text-secondary)",
                  marginTop: 4,
                }}
              >
                {token.name}
              </div>
              {/* Dollar value */}
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  color: "var(--color-text-quaternary)",
                  marginTop: 2,
                }}
              >
                {formatCompactUsd(token.liquidity)}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
