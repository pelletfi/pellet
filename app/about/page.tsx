"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import Link from "next/link";

// ── Animation variants ──────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
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
  return (
    <div style={{ width: "100%", height: 120, overflow: "hidden", position: "relative" }}>
      <motion.svg
        viewBox="0 0 1200 120"
        preserveAspectRatio="none"
        fill="none"
        style={{ width: "100%", height: "100%" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.5, delay: 0.5 }}
      >
        {[
          { d: "M0 80 Q300 20 600 60 Q900 100 1200 40", o: 0.06, delay: 0.5 },
          { d: "M0 90 Q400 30 600 70 Q800 110 1200 50", o: 0.04, delay: 0.8 },
          { d: "M0 70 Q200 10 600 50 Q1000 90 1200 30", o: 0.08, delay: 0.3 },
        ].map((arc, i) => (
          <motion.path
            key={i}
            d={arc.d}
            stroke={`rgba(255,255,255,${arc.o})`}
            strokeWidth="1"
            fill="none"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 2, delay: arc.delay, ease: "easeInOut" }}
          />
        ))}
      </motion.svg>
    </div>
  );
}

// ── Animated pipeline ───────────────────────────────────────────────────────

const pipelineSteps = [
  { num: "1", label: "Market", desc: "GeckoTerminal DEX data" },
  { num: "2", label: "Safety", desc: "Bytecode & honeypot scan" },
  { num: "3", label: "Compliance", desc: "TIP-403 policy check" },
  { num: "4", label: "Holders", desc: "Event log replay" },
  { num: "5", label: "Identity", desc: "CoinGecko + DefiLlama" },
  { num: "6", label: "Origin", desc: "Deployer trace" },
  { num: "7", label: "Synthesis", desc: "Claude analysis" },
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
      }}
    >
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
            transition={{ duration: 0.3, delay: i * 0.12, ease: [0.16, 1, 0.3, 1] }}
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
            return (
              <motion.div
                key={c}
                initial={{ opacity: 0 }}
                animate={inView ? { opacity } : {}}
                transition={{ delay: (r * cols + c) * 0.01, duration: 0.3 }}
                style={{
                  width: 6, height: 6, borderRadius: 1,
                  background: `rgba(255,255,255,${opacity})`,
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
          { label: "pelletfi.com", desc: "Web dashboard" },
          { label: "REST API", desc: "GET /v1/tokens/*" },
          { label: "MCP Server", desc: "@pelletfi/mcp" },
        ].map((box, i) => (
          <motion.div key={box.label} variants={fadeUp} style={boxStyle}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: 4 }}>{box.label}</div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--color-text-quaternary)" }}>{box.desc}</div>
          </motion.div>
        ))}
      </div>

      <motion.div variants={fadeIn} style={{ display: "flex", justifyContent: "center", padding: "10px 0", color: "var(--color-text-quaternary)", fontSize: 16 }}>↑</motion.div>

      <motion.div variants={fadeUp} style={{ ...boxStyle, marginBottom: 0 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 500, color: "var(--color-text-secondary)", marginBottom: 4 }}>Pellet Pipeline</div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--color-text-quaternary)" }}>Market → Safety → Compliance → Holders → Identity → Origin → AI</div>
      </motion.div>

      <motion.div variants={fadeIn} style={{ display: "flex", justifyContent: "center", padding: "10px 0", color: "var(--color-text-quaternary)", fontSize: 16 }}>↑</motion.div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {[
          { label: "Tempo RPC", desc: "TIP-20 · TIP-403 · DEX" },
          { label: "GeckoTerminal", desc: "Price · Volume · Pools" },
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

// ── Main page ───────────────────────────────────────────────────────────────

export default function AboutPage() {
  return (
    <div>
      {/* ═══ HERO ═══ */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={stagger}
        style={{ maxWidth: 800, margin: "0 auto", padding: "120px 48px 60px" }}
      >
        <motion.div
          variants={fadeUp}
          style={{
            fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 500,
            textTransform: "uppercase" as const, letterSpacing: "0.06em",
            color: "var(--color-text-tertiary)", marginBottom: 32,
            display: "flex", alignItems: "center", gap: 8,
          }}
        >
          <span>The Pellet Thesis</span>
          <span style={{ color: "var(--color-text-quaternary)" }}>·</span>
          <span>April 2026</span>
        </motion.div>

        <motion.h1
          variants={fadeUp}
          style={{
            fontFamily: "'Instrument Serif', Georgia, serif",
            fontSize: 48, fontWeight: 400, lineHeight: 1.15,
            letterSpacing: "-0.02em", marginBottom: 24,
          }}
        >
          The first payments chain{" "}
          <br />
          deserves <em style={{ color: "var(--color-text-secondary)" }}>its own intelligence.</em>
        </motion.h1>

        <motion.p
          variants={fadeUp}
          style={{
            fontSize: 18, lineHeight: 1.7, color: "var(--color-text-secondary)",
            maxWidth: 600, marginBottom: 0,
          }}
        >
          Tempo introduced stablecoins with enshrined compliance, a native DEX,
          and the Micropayment Protocol. Pellet is building the analytical layer
          that makes it all legible — for humans and machines.
        </motion.p>
      </motion.div>

      {/* ═══ ARC DIVIDER ═══ */}
      <ArcDivider />

      {/* ═══ STAT BREAKER ═══ */}
      <Section style={{ maxWidth: 800, margin: "0 auto 80px", padding: "0 48px" }}>
        <motion.div
          variants={fadeUp}
          style={{
            display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1,
            background: "var(--color-border-subtle)", borderRadius: 8, overflow: "hidden",
          }}
        >
          {[
            { value: "12", label: "Tokens Tracked" },
            { value: "4", label: "Stablecoins" },
            { value: "$172K", label: "24h Volume" },
            { value: "8", label: "MPP Services" },
          ].map((stat) => (
            <div key={stat.label} style={{ background: "var(--color-bg-subtle)", padding: "28px 24px", textAlign: "center" }}>
              <div style={{
                fontFamily: "var(--font-mono)", fontSize: 28, fontWeight: 600,
                fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em", marginBottom: 6,
              }}>
                {stat.value}
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

      {/* ═══ 01: WHY TEMPO ═══ */}
      <Section style={{ maxWidth: 800, margin: "0 auto", padding: "0 48px 80px" }}>
        <motion.div variants={fadeUp} style={{
          fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 500,
          color: "var(--color-text-quaternary)", letterSpacing: "0.06em", marginBottom: 12,
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
            This isn&apos;t another EVM fork. Tempo&apos;s architecture creates data structures that don&apos;t exist anywhere else — TIP-403 compliance policies, enshrined DEX orderbooks, MPP payment graphs.
          </p>
        </motion.div>

        {/* Comparison */}
        <motion.div variants={fadeUp} style={{
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1,
          background: "var(--color-border-subtle)", borderRadius: 8, overflow: "hidden", margin: "40px 0 0",
        }}>
          <div style={{ background: "var(--color-bg-subtle)", padding: 24 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 500, textTransform: "uppercase" as const, letterSpacing: "0.06em", color: "var(--color-text-quaternary)", marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid var(--color-border-subtle)" }}>Other Chains</div>
            {["Generic ERC-20 tokens", "External DEX contracts", "No native compliance", "Gas token for fees", "No payment protocol"].map((item) => (
              <div key={item} style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--color-text-tertiary)", padding: "6px 0", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--color-text-quaternary)", flexShrink: 0 }} />
                {item}
              </div>
            ))}
          </div>
          <div style={{ background: "var(--color-bg-subtle)", padding: 24 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 500, textTransform: "uppercase" as const, letterSpacing: "0.06em", color: "var(--color-text-quaternary)", marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid var(--color-border-subtle)" }}>Tempo</div>
            {["TIP-20 stablecoins (enshrined)", "Native DEX with orderbook", "TIP-403 compliance policies", "Fees in any stablecoin", "MPP — machine payments"].map((item) => (
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
        <motion.div variants={fadeUp} style={{
          fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 500,
          color: "var(--color-text-quaternary)", letterSpacing: "0.06em", marginBottom: 12,
        }}>02</motion.div>
        <motion.h2 variants={fadeUp} style={{
          fontFamily: "'Instrument Serif', Georgia, serif",
          fontSize: 32, fontWeight: 400, lineHeight: 1.2, marginBottom: 20,
        }}>What Pellet does</motion.h2>
        <motion.div variants={fadeUp} style={{ fontSize: 16, lineHeight: 1.75, color: "var(--color-text-secondary)", maxWidth: 640 }}>
          <p style={{ marginBottom: 20 }}>
            We examine every token on Tempo — safety, compliance, holder distribution, deployer origin. We track every TIP-20 stablecoin — peg stability, supply headroom, cross-pair flows. We map every MPP service as the machine economy takes shape.
          </p>
        </motion.div>

        {/* Callout */}
        <motion.div variants={fadeUp} style={{
          borderLeft: "2px solid var(--color-success)",
          padding: "20px 24px",
          margin: "32px 0",
          background: "rgba(48,164,108,0.04)",
          borderRadius: "0 8px 8px 0",
        }}>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: "var(--color-text-primary)", fontWeight: 500, margin: 0 }}>
            The briefing aggregates. The assay separates. Pellet is the analytical layer Tempo deserves.
          </p>
        </motion.div>

        <AnimatedPipeline />
      </Section>

      {/* ═══ 03: HOW IT'S BUILT ═══ */}
      <Section style={{ maxWidth: 800, margin: "0 auto", padding: "0 48px 80px" }}>
        <motion.div variants={fadeUp} style={{
          fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 500,
          color: "var(--color-text-quaternary)", letterSpacing: "0.06em", marginBottom: 12,
        }}>03</motion.div>
        <motion.h2 variants={fadeUp} style={{
          fontFamily: "'Instrument Serif', Georgia, serif",
          fontSize: 32, fontWeight: 400, lineHeight: 1.2, marginBottom: 20,
        }}>How it&apos;s built</motion.h2>
        <motion.div variants={fadeUp} style={{ fontSize: 16, lineHeight: 1.75, color: "var(--color-text-secondary)", maxWidth: 640 }}>
          <p style={{ marginBottom: 20 }}>
            Everything runs natively on Tempo. No external indexers, no subgraphs. Direct RPC calls to TIP-20 precompiles, event log replay for holder analysis, bytecode inspection for safety scanning.
          </p>
          <p style={{ marginBottom: 0 }}>
            Deep briefings are paid via MPP — $0.05 in pathUSD, settled at the protocol layer. No accounts, no API keys. Just a payment and a report.
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
        }}>
          <span style={{ color: "var(--color-text-quaternary)" }}># Analyze a token via MPP</span><br />
          <span style={{ color: "var(--color-success)" }}>$</span> mppx GET https://pelletfi.com/api/v1/tokens/0x20c0...0000/briefing<br />
          <br />
          <span style={{ color: "var(--color-text-quaternary)" }}># $0.05 pathUSD settled on-chain</span><br />
          <span style={{ color: "var(--color-success)" }}>{'{'}</span><br />
          &nbsp;&nbsp;<span style={{ color: "rgba(255,255,255,0.7)" }}>&quot;safety&quot;</span>: {'{'} <span style={{ color: "rgba(255,255,255,0.7)" }}>&quot;verdict&quot;</span>: <span style={{ color: "var(--color-success)" }}>&quot;LOW_RISK&quot;</span> {'}'},<br />
          &nbsp;&nbsp;<span style={{ color: "rgba(255,255,255,0.7)" }}>&quot;compliance&quot;</span>: {'{'} <span style={{ color: "rgba(255,255,255,0.7)" }}>&quot;type&quot;</span>: <span style={{ color: "var(--color-success)" }}>&quot;TIP-20&quot;</span> {'}'},<br />
          &nbsp;&nbsp;<span style={{ color: "rgba(255,255,255,0.7)" }}>&quot;analyst_note&quot;</span>: <span style={{ color: "rgba(255,255,255,0.5)" }}>&quot;pathUSD is Tempo&apos;s native...&quot;</span><br />
          <span style={{ color: "var(--color-success)" }}>{'}'}</span>
        </motion.div>
      </Section>

      {/* ═══ PIXEL GRID ═══ */}
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "0 48px" }}>
        <PixelGrid rows={2} cols={24} />
      </div>

      {/* ═══ 04: BUILT FROM DAY ONE ═══ */}
      <Section style={{ maxWidth: 800, margin: "0 auto", padding: "0 48px 80px" }}>
        <motion.div variants={fadeUp} style={{
          fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 500,
          color: "var(--color-text-quaternary)", letterSpacing: "0.06em", marginBottom: 12,
        }}>04</motion.div>
        <motion.h2 variants={fadeUp} style={{
          fontFamily: "'Instrument Serif', Georgia, serif",
          fontSize: 32, fontWeight: 400, lineHeight: 1.2, marginBottom: 20,
        }}>Built from day one</motion.h2>
        <motion.div variants={fadeUp} style={{ fontSize: 16, lineHeight: 1.75, color: "var(--color-text-secondary)", maxWidth: 640 }}>
          <p style={{ marginBottom: 20 }}>
            We didn&apos;t wait for the ecosystem to mature. Pellet was tracking Tempo from the first block. When the chain has 10 tokens, we examine all 10. When it has 10,000, we&apos;ll examine all 10,000.
          </p>
          <p style={{ margin: 0 }}>
            <strong style={{ color: "var(--color-text-primary)", fontWeight: 500 }}>First mover. Native builder. MPP-native compute. Here to stay.</strong>
          </p>
        </motion.div>
      </Section>

      {/* ═══ CTA ═══ */}
      <Section style={{ maxWidth: 800, margin: "0 auto", padding: "80px 48px", borderTop: "1px solid var(--color-border-subtle)", textAlign: "center" as const }}>
        <motion.h3 variants={fadeUp} style={{
          fontFamily: "'Instrument Serif', Georgia, serif",
          fontSize: 28, fontWeight: 400, marginBottom: 16,
        }}>Start exploring</motion.h3>
        <motion.p variants={fadeUp} style={{
          fontSize: 15, color: "var(--color-text-secondary)", marginBottom: 32,
          maxWidth: 480, marginLeft: "auto", marginRight: "auto", lineHeight: 1.7,
        }}>
          Every token on Tempo, examined. Every stablecoin, tracked. Every payment service, mapped.
        </motion.p>
        <motion.div variants={fadeUp} style={{ display: "flex", justifyContent: "center", gap: 12 }}>
          <Link href="/tokens" className="btn-primary" style={{ display: "inline-flex", alignItems: "center", padding: "10px 20px", fontSize: 13, fontWeight: 500, borderRadius: 6, textDecoration: "none" }}>
            Explore tokens
          </Link>
          <Link href="/terminal" className="btn-secondary" style={{ display: "inline-flex", alignItems: "center", padding: "10px 20px", fontSize: 13, fontWeight: 500, borderRadius: 6, textDecoration: "none" }}>
            Try the terminal
          </Link>
        </motion.div>
      </Section>
    </div>
  );
}
