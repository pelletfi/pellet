"use client";

import { motion, useInView, AnimatePresence } from "framer-motion";
import { useRef, useEffect, useState } from "react";
import Link from "next/link";

// ── Animation variants ──────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.08 } },
};

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.6 } },
};

// ── Scroll-triggered section wrapper ────────────────────────────────────────

function Section({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.section
      ref={ref}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      variants={stagger}
      className={className}
      style={style}
    >
      {children}
    </motion.section>
  );
}

// ── Animated arc lines ──────────────────────────────────────────────────────

function ArcDivider() {
  const arcs = [
    { o: 0.07, speed: 8, offset: 0 },
    { o: 0.04, speed: 10, offset: 2 },
    { o: 0.09, speed: 12, offset: 4 },
  ];

  return (
    <div style={{ width: "100%", height: 120, overflow: "hidden", position: "relative" }}>
      <svg
        viewBox="0 0 1200 120"
        preserveAspectRatio="none"
        fill="none"
        style={{ width: "100%", height: "100%" }}
      >
        {arcs.map((arc, i) => (
          <path
            key={i}
            stroke={`rgba(255,255,255,${arc.o})`}
            strokeWidth="1"
            fill="none"
          >
            <animate
              attributeName="d"
              dur={`${arc.speed}s`}
              repeatCount="indefinite"
              begin={`${arc.offset}s`}
              values={[
                "M0 80 Q300 20 600 60 Q900 100 1200 40",
                "M0 60 Q300 90 600 40 Q900 20 1200 70",
                "M0 50 Q300 30 600 80 Q900 50 1200 30",
                "M0 80 Q300 20 600 60 Q900 100 1200 40",
              ].join(";")}
            />
          </path>
        ))}
      </svg>
    </div>
  );
}

// ── Animated pipeline ───────────────────────────────────────────────────────

const pipelineSteps = [
  { num: "1", label: "Peg", desc: "Native DEX quote swap" },
  { num: "2", label: "Supply", desc: "TIP-20 totalSupply / cap" },
  { num: "3", label: "Policy", desc: "TIP-403 compliance state" },
  { num: "4", label: "Flows", desc: "Cross-pair event replay" },
  { num: "5", label: "Backing", desc: "Issuer + reserve context" },
  { num: "6", label: "Risk", desc: "Peg, policy, role analysis" },
  { num: "7", label: "Report", desc: "Editorial synthesis" },
];

function AnimatedPipeline() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <div
      ref={ref}
      style={{
        background: "var(--color-bg-subtle)",
        border: "1px solid var(--color-border-subtle)",
        borderRadius: 10,
        padding: "32px 32px 28px",
        margin: "40px 0",
        overflow: "hidden",
        position: "relative" as const,
      }}
    >
      <ScanLine />
      <div style={{
        fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 500,
        textTransform: "uppercase" as const, letterSpacing: "0.06em",
        color: "var(--color-text-quaternary)", marginBottom: 20,
      }}>
        Analysis Pipeline
      </div>

      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
        {pipelineSteps.map((step, i) => (
          <motion.div
            key={step.num}
            initial={{ opacity: 0, x: -8 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.3, delay: i * 0.12, ease: [0.16, 1, 0.3, 1] as const }}
            style={{ display: "flex", alignItems: "center", gap: 8 }}
          >
            {i > 0 && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={inView ? { opacity: 1 } : {}}
                transition={{ delay: i * 0.12 + 0.1 }}
                style={{ color: "var(--color-text-quaternary)", fontSize: 12, flexShrink: 0 }}
              >
                →
              </motion.span>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <motion.span
                initial={{ scale: 0 }}
                animate={inView ? { scale: 1 } : {}}
                transition={{ delay: i * 0.12 + 0.05, type: "spring", stiffness: 400, damping: 15 }}
                style={{
                  width: 24, height: 24, borderRadius: "50%",
                  background: "var(--color-text-primary)", color: "var(--color-bg-base)",
                  fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600,
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}
              >
                {step.num}
              </motion.span>
              <div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--color-text-secondary)" }}>
                  {step.label}
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--color-text-quaternary)" }}>
                  {step.desc}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ── Pixel grid decoration ───────────────────────────────────────────────────

function PixelGrid({ rows = 4, cols = 16 }: { rows?: number; cols?: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });

  return (
    <div ref={ref} style={{ display: "flex", flexDirection: "column", gap: 2, margin: "40px 0" }}>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} style={{ display: "flex", gap: 2 }}>
          {Array.from({ length: cols }).map((_, c) => {
            const dist = Math.abs(c - cols / 2) + Math.abs(r - rows / 2);
            const opacity = Math.max(0.02, 0.12 - dist * 0.008);
            const greenTint = ((r * cols + c) * 2654435761 >>> 0) % 5 === 0;
            const bg = greenTint
              ? `rgba(48,164,108,${Math.max(0.04, opacity * 0.7)})`
              : `rgba(255,255,255,${opacity})`;
            return (
              <motion.div
                key={c}
                initial={{ opacity: 0 }}
                animate={inView ? { opacity } : {}}
                transition={{ delay: (r * cols + c) * 0.01, duration: 0.3 }}
                style={{
                  width: 6, height: 6, borderRadius: 1,
                  background: bg,
                }}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── Architecture diagram (animated) ─────────────────────────────────────────

function ArchDiagram() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  const boxStyle: React.CSSProperties = {
    background: "var(--color-bg-muted)",
    border: "1px solid var(--color-border-subtle)",
    borderRadius: 6,
    padding: 16,
    textAlign: "center",
  };

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      variants={stagger}
      style={{
        background: "var(--color-bg-subtle)",
        border: "1px solid var(--color-border-subtle)",
        borderRadius: 10,
        padding: "32px 32px 28px",
        margin: "40px 0",
      }}
    >
      <div style={{
        fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 500,
        textTransform: "uppercase" as const, letterSpacing: "0.06em",
        color: "var(--color-text-quaternary)", marginBottom: 20,
      }}>
        Distribution Surfaces
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        {[
          { label: "pelletfi.com", desc: "Web explorer" },
          { label: "REST API", desc: "GET /v1/stablecoins/*" },
          { label: "MCP Server", desc: "@pelletfi/mcp" },
        ].map((box) => (
          <motion.div key={box.label} variants={fadeUp} style={boxStyle}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: 4 }}>{box.label}</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--color-text-quaternary)" }}>{box.desc}</div>
          </motion.div>
        ))}
      </div>

      <motion.div variants={fadeIn} style={{ display: "flex", justifyContent: "center", padding: "10px 0", color: "var(--color-text-quaternary)", fontSize: 16 }}>↑</motion.div>

      <motion.div variants={fadeUp} style={{ ...boxStyle, marginBottom: 0 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: 4 }}>Pellet Pipeline</div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--color-text-quaternary)" }}>Peg → Supply → Policy → Flows → Backing → Risk → Report</div>
      </motion.div>

      <motion.div variants={fadeIn} style={{ display: "flex", justifyContent: "center", padding: "10px 0", color: "var(--color-text-quaternary)", fontSize: 16 }}>↑</motion.div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        {[
          { label: "TIP-20 Precompile", desc: "Supply · Roles · Rewards" },
          { label: "TIP-403 Registry", desc: "Policies · Admins" },
          { label: "Enshrined DEX", desc: "Quote swaps · Orderbook" },
        ].map((box) => (
          <motion.div key={box.label} variants={fadeUp} style={boxStyle}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: 4 }}>{box.label}</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--color-text-quaternary)" }}>{box.desc}</div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

// ── Floating particles behind hero ──────────────────────────────────────────

function HeroParticles() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const particles = Array.from({ length: 30 }, (_, i) => {
    const seed = (i * 2654435761 + 374761393) >>> 0;
    const s2 = (seed * 2246822519 + 3266489917) >>> 0;
    const s3 = (s2 * 668265263 + 374761393) >>> 0;
    return {
      id: i,
      x: (seed % 10000) / 100,
      y: (s2 % 10000) / 100,
      size: (s3 % 200) / 100 + 1.5,
      duration: (seed % 1500) / 100 + 18,
      delay: (s2 % 500) / 100,
      opacity: (s3 % 80) / 1000 + 0.06,
    };
  });

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ opacity: 0 }}
          animate={{
            opacity: [0, p.opacity, p.opacity * 1.8, p.opacity, 0],
            y: [0, -20, -40],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: "linear",
          }}
          style={{
            position: "absolute",
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.7)",
            boxShadow: `0 0 ${p.size * 3}px rgba(255,255,255,0.15)`,
          }}
        />
      ))}
    </div>
  );
}

// ── Animated scan line effect for sections ──────────────────────────────────

function ScanLine() {
  return (
    <motion.div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        height: 1,
        background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)",
        pointerEvents: "none",
      }}
      initial={{ top: 0, opacity: 0 }}
      animate={{ top: "100%", opacity: [0, 1, 1, 0] }}
      transition={{ duration: 3, repeat: Infinity, repeatDelay: 2, ease: "linear" }}
    />
  );
}

// ── Animated counter ────────────────────────────────────────────────────────

function AnimatedNumber({ value, prefix = "" }: { value: string; prefix?: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const [display, setDisplay] = useState(prefix + "0");

  useEffect(() => {
    if (!inView) return;
    const numMatch = value.match(/[\d.]+/);
    if (!numMatch) { setDisplay(value); return; }
    const target = parseFloat(numMatch[0]);
    const suffix = value.replace(numMatch[0], "").replace(prefix, "");
    const duration = 800;
    const start = Date.now();

    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = target * eased;
      const formatted = target >= 100 ? Math.round(current).toString() : current.toFixed(target < 10 ? 0 : 1);
      setDisplay(prefix + formatted + suffix);
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [inView, value, prefix]);

  return <span ref={ref}>{display}</span>;
}

// ── Glowing network node visualization ──────────────────────────────────────

function NetworkViz() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const [hoveredNode, setHoveredNode] = useState<number | null>(null);

  const nodes = [
    { x: 80, y: 70, label: "TIP-20", size: 7, color: "rgba(255,255,255,0.5)" },
    { x: 220, y: 35, label: "DEX", size: 6, color: "rgba(255,255,255,0.5)" },
    { x: 160, y: 120, label: "TIP-403", size: 6, color: "rgba(255,255,255,0.4)" },
    { x: 340, y: 80, label: "MPP", size: 7, color: "rgba(255,255,255,0.5)" },
    { x: 440, y: 45, label: "pathUSD", size: 6, color: "rgba(255,255,255,0.6)" },
    { x: 280, y: 130, label: "Pellet", size: 9, color: "rgba(255,255,255,0.93)" },
  ];

  const edges: [number, number][] = [
    [0, 1], [0, 2], [1, 3], [2, 3], [3, 4], [5, 0], [5, 1], [5, 2], [5, 3], [5, 4],
  ];

  // Build path for the traveling orb — visits all nodes via edges
  const orbPath = [5, 0, 1, 3, 4, 3, 2, 0, 5, 3, 2, 5];
  const orbXValues = orbPath.map((idx) => nodes[idx].x);
  const orbYValues = orbPath.map((idx) => nodes[idx].y);

  return (
    <div ref={ref} style={{ position: "relative", height: 180, margin: "40px 0", overflow: "visible" }}>
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 520 180"
        fill="none"
        style={{ overflow: "visible" }}
      >
        {/* Edges */}
        {edges.map(([a, b], i) => (
          <motion.line
            key={`edge-${i}`}
            x1={nodes[a].x} y1={nodes[a].y}
            x2={nodes[b].x} y2={nodes[b].y}
            stroke={
              hoveredNode !== null && (hoveredNode === a || hoveredNode === b)
                ? "rgba(255,255,255,0.12)"
                : "rgba(255,255,255,0.05)"
            }
            strokeWidth="1"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={inView ? { pathLength: 1, opacity: 1 } : {}}
            transition={{ duration: 0.8, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] as const }}
            style={{ transition: "stroke 0.3s ease" }}
          />
        ))}

        {/* Blur filter for orb */}
        <defs>
          <filter id="orb-blur" x="-200%" y="-200%" width="500%" height="500%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" />
          </filter>
        </defs>

        {/* Traveling orb — single group so all layers move together */}
        {inView && (
          <motion.g
            animate={{ x: orbXValues, y: orbYValues }}
            transition={{ duration: 12, repeat: Infinity, ease: "linear", delay: 1 }}
          >
            {/* Soft glow */}
            <circle r={14} fill="#ffffff" opacity={0.04} filter="url(#orb-blur)" />
            {/* Blurred body */}
            <circle r={5} fill="#ffffff" opacity={0.35} filter="url(#orb-blur)">
              <animate attributeName="opacity" values="0.2;0.4;0.2" dur="2s" repeatCount="indefinite" />
            </circle>
            {/* Core */}
            <circle r={1.5} fill="#ffffff" opacity={0.8} />
          </motion.g>
        )}

        {/* Nodes */}
        {nodes.map((node, i) => (
          <motion.g
            key={`node-${i}`}
            initial={{ opacity: 0, scale: 0 }}
            animate={inView ? { opacity: 1, scale: 1 } : {}}
            transition={{ delay: 0.2 + i * 0.08, type: "spring", stiffness: 300, damping: 20 }}
            onHoverStart={() => setHoveredNode(i)}
            onHoverEnd={() => setHoveredNode(null)}
            style={{ cursor: "pointer" }}
          >
            {/* Pulse ring */}
            <motion.circle
              cx={node.x} cy={node.y}
              r={node.size + 6}
              fill="none"
              stroke={node.color}
              strokeWidth={0.5}
              opacity={hoveredNode === i ? 0.3 : 0.08}
              animate={{
                r: [node.size + 6, node.size + 12, node.size + 6],
                opacity: hoveredNode === i ? [0.3, 0.1, 0.3] : [0.08, 0.02, 0.08],
              }}
              transition={{ duration: 3, repeat: Infinity, delay: i * 0.4 }}
            />
            {/* Glow */}
            <circle
              cx={node.x} cy={node.y}
              r={node.size + 3}
              fill={node.color}
              opacity={hoveredNode === i ? 0.15 : 0.06}
              style={{ transition: "opacity 0.3s ease" }}
            />
            {/* Core */}
            <circle
              cx={node.x} cy={node.y}
              r={node.size}
              fill={node.color}
              opacity={hoveredNode === i ? 0.8 : 0.5}
              style={{ transition: "opacity 0.3s ease" }}
            />
            {/* Center dot */}
            <circle
              cx={node.x} cy={node.y}
              r={node.size * 0.35}
              fill={node.color}
              opacity={0.9}
            />
            {/* Label */}
            <text
              x={node.x} y={node.y + node.size + 16}
              textAnchor="middle"
              fill={hoveredNode === i ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.25)"}
              fontSize="9"
              fontFamily="var(--font-mono)"
              style={{ transition: "fill 0.3s ease" }}
            >
              {node.label}
            </text>
          </motion.g>
        ))}
      </svg>
    </div>
  );
}

// ── Section rule divider ───────────────────────────────────────────────────

function SectionRule() {
  return (
    <div style={{
      height: 1,
      background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)",
      margin: "0 0 40px",
    }} />
  );
}

// ── Main page ───────────────────────────────────────────────────────────────

export default function AboutPage() {
  return (
    <div>
      <style>{`
        @keyframes shimmer {
          0%, 100% { background-position: 100% 50%; }
          50% { background-position: 0% 50%; }
        }
        @keyframes callout-pulse {
          0%, 100% { border-left-color: rgba(48,164,108,0.3); }
          50% { border-left-color: rgba(48,164,108,0.8); }
        }
      `}</style>
      {/* ═══ HERO ═══ */}
      <div style={{ position: "relative" }}>
        <HeroParticles />
      <motion.div
        initial="hidden"
        animate="visible"
        variants={stagger}
        style={{ maxWidth: 800, margin: "0 auto", padding: "120px 48px 60px", position: "relative" }}
      >
        <motion.div
          variants={fadeUp}
          style={{
            fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 500,
            textTransform: "uppercase" as const, letterSpacing: "0.06em",
            color: "var(--color-text-tertiary)", marginBottom: 32,
            display: "flex", alignItems: "center", gap: 8,
          }}
        >
          <span>Stablecoin Analytics</span>
          <span style={{ color: "var(--color-text-quaternary)" }}>·</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            Built on
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/tempo-logo-white.svg" alt="Tempo" style={{ height: 10, width: "auto", opacity: 0.5 }} />
          </span>
        </motion.div>

        <motion.h1
          variants={fadeUp}
          style={{
            fontFamily: "'Instrument Serif', Georgia, serif",
            fontSize: 48, fontWeight: 400, lineHeight: 1.15,
            letterSpacing: "-0.02em", marginBottom: 24,
            textShadow: "0 0 40px rgba(255,255,255,0.1)",
          }}
        >
          The first payments chain{" "}
          <br />
          deserves its own <em style={{
            color: "var(--color-text-secondary)",
            backgroundImage: "linear-gradient(90deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.45) 35%, rgba(255,255,255,0.8) 48%, rgba(255,255,255,0.8) 52%, rgba(255,255,255,0.45) 65%, rgba(255,255,255,0.45) 100%)",
            backgroundSize: "250% 100%",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            animation: "shimmer 10s ease-in-out infinite",
          }}>stablecoin analytics.</em>
        </motion.h1>

        <motion.p
          variants={fadeUp}
          style={{
            fontSize: 18, lineHeight: 1.7, color: "var(--color-text-secondary)",
            maxWidth: 600, marginBottom: 0,
          }}
        >
          Tempo introduced TIP-20 stablecoins with enshrined compliance, native
          DEX routing, and the Micropayment Protocol. Pellet tracks every peg,
          every policy, every flow — the intelligence layer Tempo's stablecoins
          deserve.
        </motion.p>
      </motion.div>
      </div>

      {/* ═══ ARC DIVIDER ═══ */}
      <ArcDivider />

      {/* ═══ STAT BREAKER ═══ */}
      <Section style={{ maxWidth: 800, margin: "0 auto 80px", padding: "0 48px" }}>
        <motion.div
          variants={fadeUp}
          style={{
            display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8,
          }}
        >
          {[
            { value: "12", label: "Stablecoins", prefix: "" },
            { value: "172K", label: "24h Volume", prefix: "$" },
            { value: "2.8M", label: "Total Supply", prefix: "$" },
            { value: "1.85M", label: "Block Height", prefix: "" },
          ].map((stat) => (
            <div key={stat.label} style={{
              border: "1px solid var(--color-border-subtle)",
              borderRadius: 8,
              padding: "28px 24px",
              textAlign: "center",
              background: "transparent",
            }}>
              <div style={{
                fontFamily: "var(--font-mono)", fontSize: 28, fontWeight: 600,
                fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em", marginBottom: 6,
              }}>
                <AnimatedNumber value={stat.value} prefix={stat.prefix} />
              </div>
              <div style={{
                fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 500,
                textTransform: "uppercase" as const, letterSpacing: "0.06em",
                color: "var(--color-text-quaternary)",
              }}>
                {stat.label}
              </div>
            </div>
          ))}
        </motion.div>
      </Section>

      {/* ═══ NETWORK VISUALIZATION ═══ */}
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "0 48px" }}>
        <NetworkViz />
      </div>

      {/* ═══ 01: WHY TEMPO ═══ */}
      <Section style={{ maxWidth: 800, margin: "0 auto", padding: "0 48px 80px" }}>
        <SectionRule />
        <motion.div variants={fadeUp} style={{
          fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 500,
          color: "var(--color-text-quaternary)", letterSpacing: "0.06em", marginBottom: 12,
          borderBottom: "1px solid var(--color-border-subtle)", paddingBottom: 6, display: "inline-block",
        }}>01</motion.div>
        <motion.h2 variants={fadeUp} style={{
          fontFamily: "'Instrument Serif', Georgia, serif",
          fontSize: 32, fontWeight: 400, lineHeight: 1.2, marginBottom: 20,
        }}>Why Tempo matters</motion.h2>
        <motion.div variants={fadeUp} style={{ fontSize: 16, lineHeight: 1.75, color: "var(--color-text-secondary)", maxWidth: 640 }}>
          <p style={{ marginBottom: 20 }}>
            Most chains optimize for speed or cost. Tempo optimizes for <strong style={{ color: "var(--color-text-primary)", fontWeight: 500 }}>payments</strong>. That means enshrined stablecoin standards, built-in compliance policies, and a micropayment protocol that lets machines pay machines at the HTTP layer.
          </p>
          <p style={{ marginBottom: 0 }}>
            12 stablecoins already live — pathUSD at the root, USDC.e and EURC.e bridged through Stargate, USDT0 deployed natively, plus frxUSD, cUSD, rUSD, EURAU, reUSD and more. Each with TIP-20 compliance policies, supply caps, and native DEX routing. Data structures no other chain has.
          </p>
        </motion.div>

        {/* Comparison */}
        <motion.div variants={fadeUp} style={{
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1,
          background: "var(--color-border-subtle)", borderRadius: 8, overflow: "hidden", margin: "40px 0 0",
        }}>
          <div style={{ background: "var(--color-bg-subtle)", padding: 24 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 500, textTransform: "uppercase" as const, letterSpacing: "0.06em", color: "var(--color-text-quaternary)", marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid var(--color-border-subtle)" }}>Other Chains</div>
            {["Generic ERC-20 stablecoins", "External DEX routing", "No native compliance", "Gas token for fees", "Fragmented peg tracking"].map((item) => (
              <div key={item} style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--color-text-tertiary)", padding: "6px 0", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--color-text-quaternary)", flexShrink: 0 }} />
                {item}
              </div>
            ))}
          </div>
          <div style={{ background: "var(--color-bg-subtle)", padding: 24, borderLeft: "2px solid rgba(48,164,108,0.3)" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 500, textTransform: "uppercase" as const, letterSpacing: "0.06em", color: "var(--color-text-quaternary)", marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid var(--color-border-subtle)" }}>Tempo</div>
            {["TIP-20 stablecoins (enshrined)", "Native DEX with orderbook", "TIP-403 compliance policies", "Fees paid in any stablecoin", "Unified peg monitoring"].map((item) => (
              <div key={item} style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--color-text-primary)", padding: "6px 0", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--color-success)", flexShrink: 0 }} />
                {item}
              </div>
            ))}
          </div>
        </motion.div>
      </Section>

      {/* ═══ PIXEL GRID ═══ */}
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "0 48px" }}>
        <PixelGrid rows={3} cols={24} />
      </div>

      {/* ═══ 02: WHAT PELLET DOES ═══ */}
      <Section style={{ maxWidth: 800, margin: "0 auto", padding: "0 48px 80px" }}>
        <SectionRule />
        <motion.div variants={fadeUp} style={{
          fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 500,
          color: "var(--color-text-quaternary)", letterSpacing: "0.06em", marginBottom: 12,
          borderBottom: "1px solid var(--color-border-subtle)", paddingBottom: 6, display: "inline-block",
        }}>02</motion.div>
        <motion.h2 variants={fadeUp} style={{
          fontFamily: "'Instrument Serif', Georgia, serif",
          fontSize: 32, fontWeight: 400, lineHeight: 1.2, marginBottom: 20,
        }}>What Pellet does</motion.h2>
        <motion.div variants={fadeUp} style={{ fontSize: 16, lineHeight: 1.75, color: "var(--color-text-secondary)", maxWidth: 640 }}>
          <p style={{ marginBottom: 20 }}>
            We monitor every TIP-20 stablecoin on Tempo — peg stability, supply dynamics, cross-pair flows, compliance policies, role holders, backing structure. Every stablecoin gets its own editorial analysis: origin story, issuer context, risk assessment. Every flow between stablecoins is tracked natively.
          </p>
          <p style={{ marginBottom: 0 }}>
            Not a generic analytics tool bolted onto another chain. Built specifically for Tempo&apos;s TIP-20 architecture — reading enshrined DEX quotes, TIP-403 policy state, and supply cap events directly from the protocol.
          </p>
        </motion.div>

        {/* Callout */}
        <motion.div variants={fadeUp} style={{
          borderLeft: "2px solid rgba(48,164,108,0.5)",
          padding: "20px 24px",
          margin: "32px 0",
          background: "rgba(48,164,108,0.04)",
          borderRadius: "0 8px 8px 0",
          animation: "callout-pulse 3s ease-in-out infinite",
        }}>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: "var(--color-text-primary)", fontWeight: 500, margin: 0 }}>
            The briefing aggregates. The assay separates. Pellet is the analytical layer Tempo deserves.
          </p>
        </motion.div>

        <AnimatedPipeline />
      </Section>

      {/* ═══ 03: HOW IT'S BUILT ═══ */}
      <Section style={{ maxWidth: 800, margin: "0 auto", padding: "0 48px 80px" }}>
        <SectionRule />
        <motion.div variants={fadeUp} style={{
          fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 500,
          color: "var(--color-text-quaternary)", letterSpacing: "0.06em", marginBottom: 12,
          borderBottom: "1px solid var(--color-border-subtle)", paddingBottom: 6, display: "inline-block",
        }}>03</motion.div>
        <motion.h2 variants={fadeUp} style={{
          fontFamily: "'Instrument Serif', Georgia, serif",
          fontSize: 32, fontWeight: 400, lineHeight: 1.2, marginBottom: 20,
        }}>How it&apos;s built</motion.h2>
        <motion.div variants={fadeUp} style={{ fontSize: 16, lineHeight: 1.75, color: "var(--color-text-secondary)", maxWidth: 640 }}>
          <p style={{ marginBottom: 20 }}>
            Everything runs natively on Tempo. No external indexers, no subgraphs. Direct RPC calls to TIP-20 precompiles for supply and policy data, DEX quote swaps for real-time peg pricing, event log replay for flow analysis.
          </p>
          <p style={{ marginBottom: 0 }}>
            Deep stablecoin analysis is paid via MPP — $0.05 in pathUSD, settled at the protocol layer. No accounts, no API keys. Just a payment and a report. Available as an API, an MCP server for AI agents, and this site.
          </p>
        </motion.div>

        <ArchDiagram />

        {/* Code block */}
        <motion.div variants={fadeUp} style={{
          background: "var(--color-bg-subtle)",
          border: "1px solid var(--color-border-subtle)",
          borderRadius: 8,
          padding: "20px 24px",
          margin: "24px 0 0",
          fontFamily: "var(--font-mono)",
          fontSize: 13,
          lineHeight: 1.8,
          color: "var(--color-text-secondary)",
          overflowX: "auto" as const,
          position: "relative" as const,
        }}>
          {/* Copy button */}
          <div style={{
            position: "absolute", top: 12, right: 12,
            width: 28, height: 28, borderRadius: 6,
            border: "1px solid var(--color-border-subtle)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", color: "var(--color-text-quaternary)",
            transition: "color 0.2s ease, border-color 0.2s ease",
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
            </svg>
          </div>
          <div style={{ display: "table" }}>
            {[
              <><span style={{ color: "var(--color-text-quaternary)" }}># Analyze a stablecoin via MPP</span></>,
              <><span style={{ color: "var(--color-success)" }}>$</span> mppx GET https://pelletfi.com/api/v1/stablecoins/0x20c0...0000</>,
              <>&nbsp;</>,
              <><span style={{ color: "var(--color-text-quaternary)" }}># $0.05 pathUSD settled on-chain</span></>,
              <><span style={{ color: "var(--color-success)" }}>{'{'}</span></>,
              <>&nbsp;&nbsp;<span style={{ color: "rgba(255,255,255,0.7)" }}>&quot;symbol&quot;</span>: <span style={{ color: "var(--color-success)" }}>&quot;pathUSD&quot;</span>,</>,
              <>&nbsp;&nbsp;<span style={{ color: "rgba(255,255,255,0.7)" }}>&quot;peg&quot;</span>: {'{'} <span style={{ color: "rgba(255,255,255,0.7)" }}>&quot;price&quot;</span>: <span style={{ color: "var(--color-success)" }}>1.0000</span>, <span style={{ color: "rgba(255,255,255,0.7)" }}>&quot;spread_bps&quot;</span>: <span style={{ color: "var(--color-success)" }}>0</span> {'}'},</>,
              <>&nbsp;&nbsp;<span style={{ color: "rgba(255,255,255,0.7)" }}>&quot;supply&quot;</span>: {'{'} <span style={{ color: "rgba(255,255,255,0.7)" }}>&quot;current&quot;</span>: <span style={{ color: "var(--color-success)" }}>&quot;1.09M&quot;</span>, <span style={{ color: "rgba(255,255,255,0.7)" }}>&quot;cap&quot;</span>: <span style={{ color: "var(--color-success)" }}>&quot;uncapped&quot;</span> {'}'},</>,
              <>&nbsp;&nbsp;<span style={{ color: "rgba(255,255,255,0.7)" }}>&quot;policy&quot;</span>: {'{'} <span style={{ color: "rgba(255,255,255,0.7)" }}>&quot;type&quot;</span>: <span style={{ color: "var(--color-success)" }}>&quot;blacklist&quot;</span> {'}'},</>,
              <>&nbsp;&nbsp;<span style={{ color: "rgba(255,255,255,0.7)" }}>&quot;backing&quot;</span>: <span style={{ color: "var(--color-success)" }}>&quot;protocol-native&quot;</span></>,
              <><span style={{ color: "var(--color-success)" }}>{'}'}</span></>,
            ].map((line, i) => (
              <div key={i} style={{ display: "table-row" }}>
                <span style={{
                  display: "table-cell", paddingRight: 16, textAlign: "right",
                  color: "var(--color-text-quaternary)", userSelect: "none", fontSize: 11, opacity: 0.5,
                }}>{i + 1}</span>
                <span style={{ display: "table-cell" }}>{line}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </Section>

      {/* ═══ PIXEL GRID ═══ */}
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "0 48px" }}>
        <PixelGrid rows={2} cols={24} />
      </div>

      {/* ═══ 04: BUILT FROM DAY ONE ═══ */}
      <Section style={{ maxWidth: 800, margin: "0 auto", padding: "0 48px 80px" }}>
        <SectionRule />
        <motion.div variants={fadeUp} style={{
          fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 500,
          color: "var(--color-text-quaternary)", letterSpacing: "0.06em", marginBottom: 12,
          borderBottom: "1px solid var(--color-border-subtle)", paddingBottom: 6, display: "inline-block",
        }}>04</motion.div>
        <motion.h2 variants={fadeUp} style={{
          fontFamily: "'Instrument Serif', Georgia, serif",
          fontSize: 32, fontWeight: 400, lineHeight: 1.2, marginBottom: 20,
        }}>Built from day one</motion.h2>
        <motion.div variants={fadeUp} style={{ fontSize: 16, lineHeight: 1.75, color: "var(--color-text-secondary)", maxWidth: 640 }}>
          <p style={{ marginBottom: 20 }}>
            We didn&apos;t wait for the ecosystem to mature. Pellet was tracking Tempo from the first block. When the chain has 12 stablecoins, we analyze all 12. When it has 100, we&apos;ll analyze all 100.
          </p>
          <p style={{ margin: 0 }}>
            <strong style={{ color: "var(--color-text-primary)", fontWeight: 500 }}>First mover. Native builder. The stablecoin analytics layer for Tempo. Here to stay.</strong>
          </p>
        </motion.div>
      </Section>

      {/* ═══ CTA ═══ */}
      <Section style={{ maxWidth: 800, margin: "0 auto", padding: "80px 48px", borderTop: "1px solid var(--color-border-subtle)", textAlign: "center" as const, position: "relative" as const }}>
        <div style={{
          position: "absolute", top: "30%", left: "50%", transform: "translate(-50%, -50%)",
          width: 320, height: 120,
          background: "radial-gradient(ellipse at center, rgba(255,255,255,0.04) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />
        <motion.h3 variants={fadeUp} style={{
          fontFamily: "'Instrument Serif', Georgia, serif",
          fontSize: 28, fontWeight: 400, marginBottom: 16,
          position: "relative" as const,
        }}>Start exploring</motion.h3>
        <motion.p variants={fadeUp} style={{
          fontSize: 15, color: "var(--color-text-secondary)", marginBottom: 32,
          maxWidth: 480, marginLeft: "auto", marginRight: "auto", lineHeight: 1.7,
        }}>
          Every stablecoin examined. Every peg tracked. Every flow mapped. Built natively for Tempo.
        </motion.p>
        <motion.div variants={fadeUp} style={{ display: "flex", justifyContent: "center", gap: 12 }}>
          <Link href="/explorer" className="btn-primary" style={{ display: "inline-flex", alignItems: "center", padding: "10px 20px", fontSize: 13, fontWeight: 500, borderRadius: 6, textDecoration: "none" }}>
            Open Explorer
          </Link>
          <Link href="/services" className="btn-secondary" style={{ display: "inline-flex", alignItems: "center", padding: "10px 20px", fontSize: 13, fontWeight: 500, borderRadius: 6, textDecoration: "none" }}>
            View API
          </Link>
        </motion.div>
      </Section>

      {/* ═══ FOOTER WAVE DIVIDER ═══ */}
      <ArcDivider />
    </div>
  );
}
