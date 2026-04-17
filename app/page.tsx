"use client";

import { motion } from "framer-motion";
import Link from "next/link";

// ── Motion variants ─────────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] as const },
  },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.08 } },
};

// ── Peg chart (FIG. 01 — pathUSD, 90-day rolling) ──────────────────────────

function PegChart() {
  // 26 samples across 90 days. Mostly flat at $1.0000 with a gentle plateau
  // around D-60 → D-40. Matches the Paper V3 reference shape.
  const pegData = [
    1.0000, 1.0000, 1.0001, 1.0000, 0.9999,
    1.0000, 1.0002, 1.0003, 1.0004, 1.0005,
    1.0005, 1.0005, 1.0004, 1.0004, 1.0003,
    1.0002, 1.0001, 1.0000, 1.0000, 1.0000,
    0.9999, 1.0000, 1.0001, 1.0000, 1.0000,
    1.0000,
  ];

  const W = 620;
  const H = 140;
  const padL = 0; // y-axis labels live outside the SVG
  const padR = 0;
  const padT = 10;
  const padB = 10;

  const yMin = 0.9990;
  const yMax = 1.0010;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const xFor = (i: number) =>
    padL + (i / (pegData.length - 1)) * innerW;
  const yFor = (v: number) =>
    padT + ((yMax - v) / (yMax - yMin)) * innerH;

  const yGrid = [1.0008, 1.0004, 1.0000, 0.9996, 0.9992];

  // Step-like path matching Paper's plateau aesthetic
  const path = pegData
    .map((v, i) => {
      const x = xFor(i);
      const y = yFor(v);
      if (i === 0) return `M ${x.toFixed(2)} ${y.toFixed(2)}`;
      const prevX = xFor(i - 1);
      return `L ${prevX.toFixed(2)} ${y.toFixed(2)} L ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <div style={{ display: "flex", gap: 8 }}>
      {/* y-axis labels */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          paddingTop: padT,
          paddingBottom: padB,
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color: "var(--color-text-quaternary)",
          letterSpacing: "0.02em",
          minWidth: 46,
          textAlign: "right",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {yGrid.map((v) => (
          <span key={v}>{v.toFixed(4)}</span>
        ))}
      </div>

      <div style={{ flex: 1 }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          height={H}
          style={{ display: "block", overflow: "visible" }}
        >
          {/* grid */}
          {yGrid.map((v) => (
            <line
              key={v}
              x1={0}
              x2={W}
              y1={yFor(v)}
              y2={yFor(v)}
              stroke="rgba(255,255,255,0.04)"
              strokeWidth={1}
            />
          ))}

          {/* y-axis rule (left edge) */}
          <line
            x1={0}
            x2={0}
            y1={padT}
            y2={H - padB}
            stroke="rgba(255,255,255,0.14)"
            strokeWidth={1}
          />

          {/* x-axis rule (bottom edge) */}
          <line
            x1={0}
            x2={W}
            y1={H - padB}
            y2={H - padB}
            stroke="rgba(255,255,255,0.14)"
            strokeWidth={1}
          />

          {/* x-axis tick marks at each labeled position */}
          {[0, 20 / 90, 40 / 90, 60 / 90, 80 / 90, 89 / 90, 1].map((f, i) => (
            <line
              key={i}
              x1={f * W}
              x2={f * W}
              y1={H - padB}
              y2={H - padB + 4}
              stroke="rgba(255,255,255,0.28)"
              strokeWidth={1}
            />
          ))}

          {/* baseline marker at 1.0000 — faint drifting dashes */}
          <motion.line
            x1={0}
            x2={W}
            y1={yFor(1.0)}
            y2={yFor(1.0)}
            stroke="rgba(255,255,255,0.08)"
            strokeDasharray="2 4"
            strokeWidth={1}
            initial={{ strokeDashoffset: 0 }}
            animate={{ strokeDashoffset: -12 }}
            transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
          />

          {/* peg line + NOW indicator — breathes subtly (±1.5px) like a live peg */}
          <motion.g
            initial={{ y: 0 }}
            animate={{ y: [0, -1.5, 0.8, -0.6, 1.2, 0] }}
            transition={{
              duration: 9,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 1.8,
            }}
          >
            <motion.path
              d={path}
              fill="none"
              stroke="rgba(255,255,255,0.65)"
              strokeWidth={1.25}
              strokeLinecap="square"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] as const, delay: 0.3 }}
            />

            {/* NOW indicator — expanding ring */}
            <motion.circle
              cx={xFor(pegData.length - 1)}
              cy={yFor(pegData[pegData.length - 1])}
              fill="none"
              stroke="rgba(255,255,255,0.5)"
              strokeWidth={1}
              initial={{ r: 2, opacity: 0 }}
              animate={{ r: [2, 12, 12], opacity: [0.55, 0, 0] }}
              transition={{
                duration: 2.6,
                repeat: Infinity,
                ease: "easeOut",
                delay: 1.6,
              }}
            />

            {/* NOW indicator — core pulse */}
            <motion.circle
              cx={xFor(pegData.length - 1)}
              cy={yFor(pegData[pegData.length - 1])}
              fill="rgba(255,255,255,0.95)"
              initial={{ r: 0, opacity: 0 }}
              animate={{
                r: [2, 3, 2],
                opacity: [0.95, 0.5, 0.95],
              }}
              transition={{
                duration: 2.6,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 1.6,
              }}
            />
          </motion.g>
        </svg>

        {/* x-axis */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 8,
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--color-text-quaternary)",
            letterSpacing: "0.04em",
          }}
        >
          {["D-90", "D-70", "D-50", "D-30", "D-10", "D-1", "NOW"].map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div
      className="landing-root"
      style={{
        minHeight: "calc(100vh - 48px)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <style>{`
        .landing-root {
          position: relative;
          /* Provide an explicit backdrop color inside the stacking context so
             mix-blend-mode on the hero video has something to blend against.
             Without this, framer-motion's transform on <main> creates a
             stacking context whose backdrop is the transparent initial value,
             and mix-blend-mode: lighten on the video fails silently — the
             rectangle appears as the raw video, not blended into the page. */
          background-color: var(--color-bg-base);
        }
        .landing-root > * {
          position: relative;
          z-index: 1;
        }
        .landing-inner {
          max-width: 1080px;
          margin: 0 auto;
          width: 100%;
          padding: 20px 48px 16px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 16px;
          flex: 1;
        }
        .landing-hero-grid {
          display: grid;
          grid-template-columns: 1.05fr 1fr;
          gap: 56px;
          /* Center the two columns vertically so the left headline aligns
             with the VIDEO's midline, not the fig-header caption above it.
             Keeps the headline's perceived position stable regardless of
             whether the right column has chrome attached. */
          align-items: center;
        }
        .landing-hero-h1 {
          font-family: 'Instrument Serif', Georgia, serif;
          font-size: 52px;
          font-weight: 400;
          line-height: 1.02;
          letter-spacing: -0.025em;
          margin: 0 0 18px;
          text-shadow: 0 0 40px rgba(255,255,255,0.08);
        }
        .landing-hero-sub {
          font-family: var(--font-sans);
          font-size: 14.5px;
          line-height: 1.6;
          color: var(--color-text-secondary);
          max-width: 500px;
          margin: 0 0 22px;
        }
        .landing-hero-links {
          display: flex;
          align-items: center;
          gap: 24px;
          font-family: var(--font-mono);
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .landing-hero-links a {
          position: relative;
          color: var(--color-text-primary);
          text-decoration: none;
          padding-bottom: 4px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          overflow: hidden;
        }
        .landing-hero-links a::after {
          content: "";
          position: absolute;
          left: 0;
          bottom: 0;
          height: 1px;
          width: 100%;
          background: var(--color-text-primary);
          transform-origin: left;
          transition: transform 320ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .landing-hero-links a:hover::after {
          transform: scaleX(1.08);
        }
        .landing-hero-links a .arrow {
          display: inline-block;
          width: 0;
          opacity: 0;
          transform: translateX(-6px);
          transition: width 260ms cubic-bezier(0.16, 1, 0.3, 1),
                      opacity 260ms ease,
                      transform 260ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .landing-hero-links a:hover .arrow {
          width: 12px;
          opacity: 0.85;
          transform: translateX(0);
        }
        .landing-hero-links .secondary {
          color: var(--color-text-quaternary);
        }
        .fig-method-link {
          color: var(--color-text-quaternary);
          text-decoration: none;
          transition: color 200ms ease;
        }
        .fig-method-link:hover {
          color: var(--color-text-secondary);
        }
        .fig-header {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 12px;
          /* Tighter than before — the chrome should hug the video, not
             float distantly above it.  Also keeps the right column's
             overall height closer to the left column so centering reads
             as "hero section", not "caption + figure". */
          margin-bottom: 10px;
          font-family: var(--font-mono);
          font-size: 10px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--color-text-tertiary);
        }
        .fig-value {
          color: var(--color-text-primary);
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
        }
        .fig-footer {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          /* Match the fig-header tightening — chrome hugs the video. */
          margin-top: 10px;
          font-family: var(--font-mono);
          font-size: 10px;
          letter-spacing: 0.06em;
          color: var(--color-text-quaternary);
          text-transform: uppercase;
        }
        .stats-strip {
          border-top: 1px solid var(--color-border-subtle);
          padding-top: 20px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .fig02-header {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          font-family: var(--font-mono);
          font-size: 10px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--color-text-tertiary);
        }
        .fig02-evidence {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 16px;
          font-family: var(--font-mono);
          font-size: 11px;
          letter-spacing: 0.02em;
          color: var(--color-text-secondary);
          font-variant-numeric: tabular-nums;
        }
        .stats-version {
          font-family: var(--font-mono);
          font-size: 10px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--color-text-quaternary);
          white-space: nowrap;
        }
        @media (max-width: 960px) {
          .landing-hero-grid { grid-template-columns: 1fr; gap: 40px; }
          .landing-root { min-height: 0 !important; }
          .fig02-evidence { flex-wrap: wrap; gap: 6px 16px; }
        }
        @media (max-width: 560px) {
          .landing-inner { padding: 20px 16px; }
          .landing-hero-h1 { font-size: 38px; }
          .landing-hero-sub { font-size: 14px; }
          .fig-header {
            flex-direction: column;
            gap: 4px;
            align-items: flex-start;
          }
          .fig-footer {
            flex-direction: column;
            gap: 4px;
          }
          .fig02-header {
            flex-direction: column;
            gap: 4px;
            align-items: flex-start;
          }
          .fig02-evidence {
            flex-direction: column;
            align-items: flex-start;
            gap: 8px;
            font-size: 10.5px;
          }
          .stats-version { font-size: 9px; }
        }
      `}</style>

      <motion.div
        initial="hidden"
        animate="visible"
        variants={stagger}
        className="landing-inner"
      >
        {/* Folio rule */}
        <motion.div
          variants={fadeUp}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--color-text-quaternary)",
          }}
        >
          <span>MPP-Native</span>
          <motion.span
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 1.2, delay: 0.4, ease: [0.16, 1, 0.3, 1] as const }}
            style={{
              flex: 1,
              height: 1,
              background: "var(--color-border-default)",
              transformOrigin: "left",
            }}
          />
          <span>Tempo-Native</span>
        </motion.div>

        {/* Hero grid */}
        <div className="landing-hero-grid">
          {/* LEFT: headline + subhead + inline links */}
          <div>
            <motion.h1 variants={fadeUp} className="landing-hero-h1">
              Open-Ledger Interface on{" "}
              <em style={{ fontStyle: "italic", color: "var(--color-text-primary)" }}>
                Tempo.
              </em>
            </motion.h1>

            <motion.p variants={fadeUp} className="landing-hero-sub">
              Tempo introduced TIP-20 stablecoins with enshrined compliance,
              native DEX routing, and the Micropayment Protocol. Pellet tracks
              every peg, every policy, every flow.
            </motion.p>

            <motion.div variants={fadeUp} className="landing-hero-links">
              <Link href="/explorer">
                Open Explorer
                <span className="arrow" aria-hidden>→</span>
              </Link>
              <span className="secondary">SDK · MCP · API</span>
            </motion.div>
          </div>

          {/* RIGHT: live data-flow capture — right-aligned chrome only */}
          <motion.div variants={fadeUp}>
            <div className="fig-header" style={{ justifyContent: "flex-end" }}>
              <span className="fig-value">TIP-20 · Tempo mainnet</span>
            </div>

            {/*
              Isolating wrapper so mix-blend-mode has a known backdrop color.
              Framer-motion wraps this hero element in a transform, creating
              a stacking context whose default backdrop is transparent — that
              kills blend-mode math and the raw video pixels render through.
              By giving this wrapper `isolation: isolate` + the exact page
              bg colour, the video's lighten blends against a real dark
              backdrop and pure-black pixels match the page exactly.
            */}
            <div
              style={{
                isolation: "isolate",
                backgroundColor: "var(--color-bg-base)",
                width: "100%",
                aspectRatio: "1280 / 711",
              }}
            >
              <video
                ref={(el) => {
                  if (el && el.paused) el.play().catch(() => {});
                }}
                src="/hero.mp4"
                poster="/hero-poster.jpg"
                autoPlay
                muted
                loop
                playsInline
                preload="auto"
                aria-label="Ambient capture of Pellet's Tempo on-chain data stream"
                style={{
                  width: "100%",
                  height: "100%",
                  display: "block",
                  mixBlendMode: "lighten",
                }}
              />
            </div>

            <div className="fig-footer" style={{ justifyContent: "flex-end" }}>
              <Link href="/docs/oli" className="fig-method-link">
                OLI
                <motion.span
                  aria-hidden
                  style={{ display: "inline-block", marginLeft: 4 }}
                  animate={{ y: [0, -1.5, 0], x: [0, 1.5, 0] }}
                  transition={{
                    duration: 2.6,
                    repeat: Infinity,
                    repeatDelay: 1.8,
                    ease: "easeInOut",
                  }}
                >
                  ↗
                </motion.span>
              </Link>
            </div>
          </motion.div>
        </div>

        {/* Fig. 02 — pathUSD aggregate */}
        <motion.div variants={fadeUp} className="stats-strip">
          <div className="fig02-header">
            <span>Fig. 02 · pathUSD aggregate</span>
            <span className="fig-value">90d rolling · 12 stables</span>
          </div>
          <PegChart />
          <div className="fig02-evidence">
            <span>
              $2.81M aggregate supply · $172K 24h flow · all pegs within ±4bp · captured at blk 15,279,560
            </span>
            <span className="stats-version">Pellet · v1.3.0 · Methodology v1.0</span>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
