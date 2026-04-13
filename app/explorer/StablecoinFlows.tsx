"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";

// Mirrors KNOWN_STABLECOINS from lib/pipeline/stablecoins.ts
const KNOWN_STABLECOINS = [
  { address: "0x20c0000000000000000000000000000000000000", symbol: "pathUSD" },
  { address: "0x20c000000000000000000000b9537d11c60e8b50", symbol: "USDC.e" },
  { address: "0x20c00000000000000000000014f22ca97301eb73", symbol: "USDT0" },
];

interface FlowRecord {
  from_token: string;
  to_token: string;
  net_flow_usd: number;
  tx_count: number;
  from_symbol?: string;
  to_symbol?: string;
}

interface AggregatedFlow {
  from: string;
  to: string;
  fromSymbol: string;
  toSymbol: string;
  usd: number;
  txCount: number;
}

function symbolFor(address: string): string {
  const lc = address.toLowerCase();
  return (
    KNOWN_STABLECOINS.find((s) => s.address.toLowerCase() === lc)?.symbol ??
    `${address.slice(0, 6)}...`
  );
}

function formatUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  if (n > 0) return `$${n.toFixed(0)}`;
  return "$0";
}

// SVG layout constants
const SVG_W = 500;
const SVG_H = 220;
const NODE_W = 80;
const NODE_H = 32;
const NODE_R = 4;
const LEFT_X = 20;
const RIGHT_X = SVG_W - NODE_W - 20;
const TOP_Y = 30;

export function StablecoinFlows() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });

  const [flows, setFlows] = useState<AggregatedFlow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/v1/stablecoins/flows?hours=24");
        if (!res.ok) throw new Error("API error");
        const json = await res.json();
        const raw: FlowRecord[] = json.flows ?? [];

        // Aggregate hourly records into unique from->to pairs
        // All DEX swaps route through pathUSD, so replace "unknown" with pathUSD
        const PATHUSD = "0x20c0000000000000000000000000000000000000";
        const map = new Map<string, AggregatedFlow>();
        for (const r of raw) {
          const fromAddr = r.from_token === "unknown" ? PATHUSD : r.from_token;
          const toAddr = r.to_token === "unknown" ? PATHUSD : r.to_token;
          // Skip self-flows
          if (fromAddr.toLowerCase() === toAddr.toLowerCase()) continue;
          const key = `${fromAddr.toLowerCase()}:${toAddr.toLowerCase()}`;
          const existing = map.get(key);
          if (existing) {
            existing.usd += r.net_flow_usd;
            existing.txCount += r.tx_count;
          } else {
            map.set(key, {
              from: fromAddr,
              to: toAddr,
              fromSymbol: r.from_symbol ?? symbolFor(fromAddr),
              toSymbol: r.to_symbol ?? symbolFor(toAddr),
              usd: r.net_flow_usd,
              txCount: r.tx_count,
            });
          }
        }

        const aggregated = [...map.values()]
          .filter((f) => f.usd > 0)
          .sort((a, b) => b.usd - a.usd);

        if (!cancelled) setFlows(aggregated);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Collect unique source and destination symbols for layout
  const sourceSymbols = [...new Set(flows.map((f) => f.fromSymbol))];
  const destSymbols = [...new Set(flows.map((f) => f.toSymbol))];

  // Compute vertical positions for nodes
  const sourceY = (i: number) => {
    const spacing =
      sourceSymbols.length > 1
        ? (SVG_H - TOP_Y - NODE_H - 20) / (sourceSymbols.length - 1)
        : 0;
    return TOP_Y + i * spacing;
  };
  const destY = (i: number) => {
    const spacing =
      destSymbols.length > 1
        ? (SVG_H - TOP_Y - NODE_H - 20) / (destSymbols.length - 1)
        : 0;
    return TOP_Y + i * spacing;
  };

  // Max flow for strokeWidth scaling
  const maxUsd = Math.max(...flows.map((f) => f.usd), 1);

  // Net flow calculation
  const netFlow = flows.reduce((sum, f) => sum + f.usd, 0);

  const hasData = flows.length > 0;

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
        STABLECOIN FLOWS &middot; 24H
      </div>

      {/* Body */}
      {loading ? (
        <div
          style={{
            height: 200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "rgba(255,255,255,0.28)",
          }}
        >
          Loading...
        </div>
      ) : error || !hasData ? (
        <div
          style={{
            height: 200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "rgba(255,255,255,0.28)",
          }}
        >
          No flow data available
        </div>
      ) : (
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          style={{ width: "100%", height: "auto", display: "block" }}
        >
          {/* Curves — ghost layer (wider, more transparent) */}
          {flows.map((flow, i) => {
            const si = sourceSymbols.indexOf(flow.fromSymbol);
            const di = destSymbols.indexOf(flow.toSymbol);
            if (si < 0 || di < 0) return null;

            const x1 = LEFT_X + NODE_W;
            const y1 = sourceY(si) + NODE_H / 2;
            const x2 = RIGHT_X;
            const y2 = destY(di) + NODE_H / 2;
            const cx1 = x1 + (x2 - x1) * 0.4;
            const cx2 = x2 - (x2 - x1) * 0.4;
            const d = `M ${x1} ${y1} C ${cx1} ${y1}, ${cx2} ${y2}, ${x2} ${y2}`;

            const ratio = flow.usd / maxUsd;
            const sw = 2 + ratio * 8; // min 2, max 10
            const ghostOpacity = 0.03 + ratio * 0.04;

            return (
              <motion.path
                key={`ghost-${i}`}
                d={d}
                fill="none"
                stroke={`rgba(255,255,255,${ghostOpacity})`}
                strokeWidth={sw + 4}
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={inView ? { pathLength: 1 } : { pathLength: 0 }}
                transition={{
                  duration: 0.8,
                  delay: 0.1 + i * 0.08,
                  ease: [0.16, 1, 0.3, 1],
                }}
              />
            );
          })}

          {/* Curves — bright layer */}
          {flows.map((flow, i) => {
            const si = sourceSymbols.indexOf(flow.fromSymbol);
            const di = destSymbols.indexOf(flow.toSymbol);
            if (si < 0 || di < 0) return null;

            const x1 = LEFT_X + NODE_W;
            const y1 = sourceY(si) + NODE_H / 2;
            const x2 = RIGHT_X;
            const y2 = destY(di) + NODE_H / 2;
            const cx1 = x1 + (x2 - x1) * 0.4;
            const cx2 = x2 - (x2 - x1) * 0.4;
            const d = `M ${x1} ${y1} C ${cx1} ${y1}, ${cx2} ${y2}, ${x2} ${y2}`;

            const ratio = flow.usd / maxUsd;
            const sw = 2 + ratio * 8;
            const lineOpacity = 0.07 + ratio * 0.05;

            return (
              <motion.path
                key={`line-${i}`}
                d={d}
                fill="none"
                stroke={`rgba(255,255,255,${lineOpacity})`}
                strokeWidth={sw}
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={inView ? { pathLength: 1 } : { pathLength: 0 }}
                transition={{
                  duration: 0.8,
                  delay: 0.1 + i * 0.08,
                  ease: [0.16, 1, 0.3, 1],
                }}
              />
            );
          })}

          {/* Flow value labels on curves */}
          {flows.map((flow, i) => {
            const si = sourceSymbols.indexOf(flow.fromSymbol);
            const di = destSymbols.indexOf(flow.toSymbol);
            if (si < 0 || di < 0) return null;

            const y1 = sourceY(si) + NODE_H / 2;
            const y2 = destY(di) + NODE_H / 2;
            const midX = SVG_W / 2;
            const midY = (y1 + y2) / 2;

            return (
              <motion.text
                key={`label-${i}`}
                x={midX}
                y={midY - 4}
                textAnchor="middle"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  fill: "rgba(255,255,255,0.28)",
                }}
                initial={{ opacity: 0 }}
                animate={inView ? { opacity: 1 } : { opacity: 0 }}
                transition={{
                  duration: 0.4,
                  delay: 0.5 + i * 0.08,
                }}
              >
                {formatUsd(flow.usd)}
              </motion.text>
            );
          })}

          {/* Source nodes (left) */}
          {sourceSymbols.map((sym, i) => {
            const y = sourceY(i);
            return (
              <g key={`src-${sym}`}>
                <rect
                  x={LEFT_X}
                  y={y}
                  width={NODE_W}
                  height={NODE_H}
                  rx={NODE_R}
                  ry={NODE_R}
                  fill="rgba(255,255,255,0.06)"
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth={1}
                />
                <text
                  x={LEFT_X + NODE_W / 2}
                  y={y + NODE_H / 2 + 1}
                  textAnchor="middle"
                  dominantBaseline="central"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    fill: "rgba(255,255,255,0.63)",
                  }}
                >
                  {sym}
                </text>
              </g>
            );
          })}

          {/* Destination nodes (right) */}
          {destSymbols.map((sym, i) => {
            const y = destY(i);
            return (
              <g key={`dst-${sym}`}>
                <rect
                  x={RIGHT_X}
                  y={y}
                  width={NODE_W}
                  height={NODE_H}
                  rx={NODE_R}
                  ry={NODE_R}
                  fill="rgba(255,255,255,0.06)"
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth={1}
                />
                <text
                  x={RIGHT_X + NODE_W / 2}
                  y={y + NODE_H / 2 + 1}
                  textAnchor="middle"
                  dominantBaseline="central"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    fill: "rgba(255,255,255,0.63)",
                  }}
                >
                  {sym}
                </text>
              </g>
            );
          })}

          {/* Net flow summary */}
          <text
            x={SVG_W / 2}
            y={SVG_H - 8}
            textAnchor="middle"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              fill: "rgba(255,255,255,0.20)",
            }}
          >
            NET FLOW: {formatUsd(netFlow)} &middot;{" "}
            {flows.reduce((s, f) => s + f.txCount, 0)} txns
          </text>
        </svg>
      )}
    </div>
  );
}
