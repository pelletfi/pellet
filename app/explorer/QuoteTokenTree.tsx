"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";

// ── Types ──────────────────────────────────────────────────────────────────

interface StablecoinRecord {
  address: string;
  symbol: string;
}

interface TreeNode {
  x: number;
  y: number;
  symbol: string;
  isRoot: boolean;
}

// ── SVG constants ──────────────────────────────────────────────────────────

const SVG_W = 600;
const SVG_H = 260;
const CX = SVG_W / 2;
const CY = SVG_H / 2;
const ROOT_R = 10;
const NODE_R = 6;
const ORBIT_R = 90;

// ── Component ──────────────────────────────────────────────────────────────

export function QuoteTokenTree() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });

  const [nodes, setNodes] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/v1/stablecoins");
        if (!res.ok) throw new Error("API error");
        const json = await res.json();
        const stablecoins: StablecoinRecord[] = (json.stablecoins ?? []).map(
          (s: { address: string; symbol: string }) => ({
            address: s.address,
            symbol: s.symbol,
          })
        );

        if (cancelled) return;

        // pathUSD is root at center; all others orbit around it
        const root: TreeNode = { x: CX, y: CY, symbol: "pathUSD", isRoot: true };
        const children = stablecoins.filter(
          (s) => s.symbol.toLowerCase() !== "pathusd"
        );

        const childNodes: TreeNode[] = children.map((s, i) => {
          const angle =
            children.length === 1
              ? -Math.PI / 2
              : -Math.PI / 2 + (i / children.length) * 2 * Math.PI;
          return {
            x: CX + ORBIT_R * Math.cos(angle),
            y: CY + ORBIT_R * Math.sin(angle),
            symbol: s.symbol,
            isRoot: false,
          };
        });

        setNodes([root, ...childNodes]);
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

  // Root is always index 0; children are 1..n
  const rootNode = nodes[0];
  const childNodes = nodes.slice(1);

  // Orb path: visit each child then return to root, loop
  const orbPath: number[] = [];
  if (childNodes.length > 0) {
    for (const ci of childNodes.keys()) {
      orbPath.push(0);       // from root
      orbPath.push(ci + 1);  // to child
    }
    orbPath.push(0); // back to root to close the loop
  }
  const orbXValues = orbPath.map((idx) => nodes[idx]?.x ?? CX);
  const orbYValues = orbPath.map((idx) => nodes[idx]?.y ?? CY);

  const hasData = nodes.length > 1;

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
        QUOTE TOKEN TREE
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
          No stablecoin data available
        </div>
      ) : (
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          style={{ width: "100%", height: "auto", display: "block" }}
        >
          {/* Blur filter for orb */}
          <defs>
            <filter
              id="quote-orb-blur"
              x="-200%"
              y="-200%"
              width="500%"
              height="500%"
            >
              <feGaussianBlur in="SourceGraphic" stdDeviation="6" />
            </filter>
          </defs>

          {/* Edges: each child -> root (directed) */}
          {childNodes.map((child, i) => {
            const isHovered = hoveredNode === i + 1 || hoveredNode === 0;
            return (
              <motion.line
                key={`edge-${i}`}
                x1={child.x}
                y1={child.y}
                x2={rootNode.x}
                y2={rootNode.y}
                stroke={
                  isHovered
                    ? "rgba(255,255,255,0.12)"
                    : "rgba(255,255,255,0.05)"
                }
                strokeWidth="1"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={inView ? { pathLength: 1, opacity: 1 } : {}}
                transition={{
                  duration: 0.8,
                  delay: 0.1 + i * 0.1,
                  ease: [0.16, 1, 0.3, 1] as const,
                }}
                style={{ transition: "stroke 0.3s ease" }}
              />
            );
          })}

          {/* Direction arrows (small triangle at midpoint toward root) */}
          {childNodes.map((child, i) => {
            const mx = (child.x + rootNode.x) / 2;
            const my = (child.y + rootNode.y) / 2;
            const dx = rootNode.x - child.x;
            const dy = rootNode.y - child.y;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            const nx = dx / len;
            const ny = dy / len;
            // perpendicular
            const px = -ny;
            const py = nx;
            const s = 4;
            const isHovered = hoveredNode === i + 1 || hoveredNode === 0;

            return (
              <motion.polygon
                key={`arrow-${i}`}
                points={`${mx + nx * s},${my + ny * s} ${mx - nx * 2 + px * s * 0.6},${my - ny * 2 + py * s * 0.6} ${mx - nx * 2 - px * s * 0.6},${my - ny * 2 - py * s * 0.6}`}
                fill={
                  isHovered
                    ? "rgba(255,255,255,0.15)"
                    : "rgba(255,255,255,0.07)"
                }
                initial={{ opacity: 0 }}
                animate={inView ? { opacity: 1 } : {}}
                transition={{
                  duration: 0.4,
                  delay: 0.5 + i * 0.1,
                }}
                style={{ transition: "fill 0.3s ease" }}
              />
            );
          })}

          {/* Traveling orb */}
          {inView && orbPath.length > 1 && (
            <motion.g
              animate={{ x: orbXValues, y: orbYValues }}
              transition={{
                duration: orbPath.length * 1.2,
                repeat: Infinity,
                ease: "linear",
                delay: 1,
              }}
            >
              {/* Soft glow */}
              <circle
                r={14}
                fill="#ffffff"
                opacity={0.04}
                filter="url(#quote-orb-blur)"
              />
              {/* Blurred body */}
              <circle
                r={5}
                fill="#ffffff"
                opacity={0.35}
                filter="url(#quote-orb-blur)"
              >
                <animate
                  attributeName="opacity"
                  values="0.2;0.4;0.2"
                  dur="2s"
                  repeatCount="indefinite"
                />
              </circle>
              {/* Core */}
              <circle r={1.5} fill="#ffffff" opacity={0.8} />
            </motion.g>
          )}

          {/* Nodes */}
          {nodes.map((node, i) => {
            const r = node.isRoot ? ROOT_R : NODE_R;
            const isHovered = hoveredNode === i;

            return (
              <motion.g
                key={`node-${i}`}
                initial={{ opacity: 0, scale: 0 }}
                animate={inView ? { opacity: 1, scale: 1 } : {}}
                transition={{
                  delay: 0.2 + i * 0.08,
                  type: "spring",
                  stiffness: 300,
                  damping: 20,
                }}
                onHoverStart={() => setHoveredNode(i)}
                onHoverEnd={() => setHoveredNode(null)}
                style={{ cursor: "pointer" }}
              >
                {/* Pulse ring */}
                <motion.circle
                  cx={node.x}
                  cy={node.y}
                  r={r + 6}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth={0.5}
                  opacity={isHovered ? 0.3 : 0.08}
                  animate={{
                    r: [r + 6, r + 12, r + 6],
                    opacity: isHovered
                      ? [0.3, 0.1, 0.3]
                      : [0.08, 0.02, 0.08],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    delay: i * 0.4,
                  }}
                />
                {/* Outer glow */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={r + 3}
                  fill="rgba(255,255,255,0.06)"
                  opacity={isHovered ? 0.15 : 0.06}
                  style={{ transition: "opacity 0.3s ease" }}
                />
                {/* Main circle */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={r}
                  fill="rgba(255,255,255,0.06)"
                  stroke={
                    isHovered
                      ? "rgba(255,255,255,0.2)"
                      : "rgba(255,255,255,0.08)"
                  }
                  strokeWidth={1}
                  opacity={isHovered ? 0.9 : 0.7}
                  style={{ transition: "stroke 0.3s ease, opacity 0.3s ease" }}
                />
                {/* Brighter center dot */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={r * 0.35}
                  fill="#ffffff"
                  opacity={isHovered ? 0.9 : node.isRoot ? 0.6 : 0.45}
                  style={{ transition: "opacity 0.3s ease" }}
                />
                {/* Label */}
                <text
                  x={node.x}
                  y={node.y + r + 16}
                  textAnchor="middle"
                  fill={
                    isHovered
                      ? "rgba(255,255,255,0.6)"
                      : node.isRoot
                        ? "rgba(255,255,255,0.44)"
                        : "rgba(255,255,255,0.25)"
                  }
                  fontSize="9"
                  fontFamily="var(--font-mono)"
                  style={{ transition: "fill 0.3s ease" }}
                >
                  {node.symbol}
                </text>
              </motion.g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
