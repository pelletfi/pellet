"use client";
/* eslint-disable @next/next/no-img-element */

import { motion, useInView } from "framer-motion";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { StablecoinData } from "@/lib/types";
import type { StablecoinEditorial } from "@/lib/stablecoin-editorial";

// ── Animation variants ──────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const },
  },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } },
};

// ── Scroll-triggered section wrapper ────────────────────────────────────────

function Section({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.section
      ref={ref}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      variants={stagger}
      style={style}
    >
      {children}
    </motion.section>
  );
}

function SectionRule() {
  return (
    <div
      style={{
        height: 1,
        background:
          "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)",
        margin: "64px 0 40px",
      }}
    />
  );
}

function SectionNumber({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      variants={fadeUp}
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        fontWeight: 500,
        color: "var(--color-text-quaternary)",
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        marginBottom: 12,
      }}
    >
      {children}
    </motion.div>
  );
}

function SectionHeadline({ children }: { children: React.ReactNode }) {
  return (
    <motion.h2
      variants={fadeUp}
      style={{
        fontFamily: "'Instrument Serif', Georgia, serif",
        fontSize: 32,
        fontWeight: 400,
        lineHeight: 1.2,
        letterSpacing: "-0.01em",
        marginBottom: 24,
        color: "var(--color-text-primary)",
      }}
    >
      {children}
    </motion.h2>
  );
}

function BodyProse({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      variants={fadeUp}
      style={{
        fontSize: 16,
        lineHeight: 1.75,
        color: "var(--color-text-secondary)",
        maxWidth: 640,
      }}
    >
      {children}
    </motion.div>
  );
}

function DataCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <motion.div
      variants={fadeUp}
      style={{
        border: "1px solid var(--color-border-subtle)",
        borderRadius: 8,
        padding: 20,
        background: "var(--color-bg-subtle)",
        ...style,
      }}
    >
      {children}
    </motion.div>
  );
}

function DataRow({
  label,
  value,
  mono = true,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "10px 0",
        borderBottom: "1px solid var(--color-border-subtle)",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          color: "var(--color-text-tertiary)",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)",
          fontSize: 14,
          color: "var(--color-text-primary)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function BackingBadge({
  type,
}: {
  type: StablecoinEditorial["backingType"];
}) {
  return (
    <span
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        fontWeight: 500,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        color: "var(--color-text-secondary)",
        background: "rgba(255,255,255,0.04)",
        border: "1px solid var(--color-border-subtle)",
        borderRadius: 4,
        padding: "2px 8px",
        display: "inline-block",
      }}
    >
      {type}
    </span>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatSupply(raw: string, decimals = 6): string {
  const n = parseInt(raw, 10) / 10 ** decimals;
  if (!isFinite(n) || n === 0) return "$0";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function formatSupplyRaw(raw: string, decimals = 6): number {
  const n = parseInt(raw, 10) / 10 ** decimals;
  return isFinite(n) ? n : 0;
}

function truncate(addr: string): string {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function pegDeviationColor(price: number): string {
  const dev = Math.abs(price - 1);
  if (dev < 0.001) return "var(--color-success)";
  if (dev < 0.005) return "var(--color-warning)";
  return "var(--color-error)";
}

function pegDeviationBps(price: number): number {
  return Math.round((price - 1) * 10000);
}

// ── Peg sparkline (simulated — no historical data yet) ──────────────────────

function PegSparkline({ price }: { price: number }) {
  // Deterministic wavy line that stays within ±deviation bounds
  const width = 640;
  const height = 80;
  const midline = height / 2;
  const points = 60;
  const deviation = Math.max(2, Math.abs(price - 1) * 2000);
  const color = pegDeviationColor(price);

  const values: number[] = [];
  for (let i = 0; i < points; i++) {
    // simple layered sin waves for a subtle organic shape
    const t = i / (points - 1);
    const v =
      Math.sin(t * Math.PI * 4) * 0.6 +
      Math.sin(t * Math.PI * 7 + 1.2) * 0.3 +
      Math.sin(t * Math.PI * 11 + 2.4) * 0.15;
    values.push(midline - v * deviation);
  }
  // Anchor final point to current-price-scaled offset
  const finalOffset = (price - 1) * 10000 * 0.3;
  values[values.length - 1] = midline - finalOffset;

  const step = width / (points - 1);
  const path = values
    .map((y, i) => `${i === 0 ? "M" : "L"} ${(i * step).toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");

  const fillPath = `${path} L ${width} ${height} L 0 ${height} Z`;

  return (
    <div
      style={{
        width: "100%",
        aspectRatio: `${width} / ${height}`,
        maxHeight: 120,
        position: "relative",
      }}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        style={{ width: "100%", height: "100%", display: "block" }}
      >
        {/* midline */}
        <line
          x1="0"
          y1={midline}
          x2={width}
          y2={midline}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="1"
          strokeDasharray="2 4"
        />
        {/* fill */}
        <motion.path
          d={fillPath}
          fill={color}
          opacity={0.06}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.06 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        />
        {/* line */}
        <motion.path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] as const }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          top: 6,
          left: 0,
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color: "var(--color-text-quaternary)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        $1.00 peg
      </div>
    </div>
  );
}

// ── Supply cap bar ──────────────────────────────────────────────────────────

// ── Backing & reserves panel — fetched from /api/v1/stablecoins/:address/reserves ──

interface ReserveEntry {
  reserve_type: string;
  backing_usd: number | null;
  attestation_source: string | null;
  attested_at: string | null;
  verified_by: string | null;
  notes: { label?: string; issuer?: string; backing_model?: string } | null;
}

function formatUsd(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function ReservesPanel({ address }: { address: string }) {
  const [total, setTotal] = useState<number | null>(null);
  const [reserves, setReserves] = useState<ReserveEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/v1/stablecoins/${address}/reserves`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setTotal(data.total_backing_usd ?? null);
        setReserves(data.reserves ?? []);
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [address]);

  if (loading || reserves.length === 0) return null;

  return (
    <motion.div
      variants={fadeUp}
      style={{
        marginTop: 32,
        padding: "24px",
        border: "1px solid var(--color-border-subtle)",
        borderRadius: 8,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 20 }}>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            fontWeight: 500,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "var(--color-text-quaternary)",
          }}
        >
          Reserves
        </div>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 20,
            fontWeight: 500,
            color: "var(--color-text-primary)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {formatUsd(total)}
        </div>
      </div>
      {reserves.map((r) => (
        <div
          key={r.reserve_type}
          style={{
            paddingTop: 16,
            borderTop: "1px solid var(--color-border-subtle)",
            marginTop: 16,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: "var(--color-text-secondary)",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              {r.reserve_type.replace(/_/g, " ")}
            </span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 13,
                color: "var(--color-text-primary)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {formatUsd(r.backing_usd)}
            </span>
          </div>
          {r.notes?.backing_model && (
            <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--color-text-tertiary)", margin: "6px 0" }}>
              {r.notes.backing_model}
            </p>
          )}
          {r.attestation_source && (
            <a
              href={r.attestation_source}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-block",
                marginTop: 4,
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--color-text-quaternary)",
                textDecoration: "underline",
                textDecorationColor: "var(--color-border-subtle)",
                textUnderlineOffset: 3,
              }}
            >
              {new URL(r.attestation_source).host}
            </a>
          )}
        </div>
      ))}
    </motion.div>
  );
}

// ── Risk score panel — fetched from /api/v1/stablecoins/:address/risk ──

interface RiskResponse {
  composite: number;
  components: { peg_risk?: number; peg_break_risk?: number; supply_risk?: number; policy_risk?: number };
  computed_at: string;
}

function RiskPanel({ address }: { address: string }) {
  const [risk, setRisk] = useState<RiskResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/v1/stablecoins/${address}/risk`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => !cancelled && setRisk(data))
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [address]);

  if (loading || !risk || risk.composite == null) return null;

  // Composite thresholds for verdict
  const composite = risk.composite;
  const verdict =
    composite < 15 ? "low" : composite < 35 ? "moderate" : composite < 60 ? "elevated" : "high";

  return (
    <motion.div
      variants={fadeUp}
      style={{
        marginTop: 16,
        padding: "24px",
        border: "1px solid var(--color-border-subtle)",
        borderRadius: 8,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 20 }}>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            fontWeight: 500,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "var(--color-text-quaternary)",
          }}
        >
          Composite risk score
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 24,
              fontWeight: 500,
              color: "var(--color-text-primary)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {composite.toFixed(1)}
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--color-text-quaternary)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            / 100 · {verdict}
          </span>
        </div>
      </div>
      <div className="risk-components-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1, background: "var(--color-border-subtle)", borderRadius: 6, overflow: "hidden" }}>
        <RiskComponent label="Peg" value={risk.components.peg_risk ?? 0} />
        <RiskComponent label="Peg break" value={risk.components.peg_break_risk ?? 0} />
        <RiskComponent label="Supply" value={risk.components.supply_risk ?? 0} />
        <RiskComponent label="Policy" value={risk.components.policy_risk ?? 0} />
      </div>
    </motion.div>
  );
}

function RiskComponent({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ background: "var(--color-bg-base)", padding: "14px 12px" }}>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color: "var(--color-text-quaternary)",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 15,
          color: "var(--color-text-primary)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value.toFixed(0)}
      </div>
    </div>
  );
}

// ── Historical peg stats — fetched from /api/v1/stablecoins/:address/peg ────

interface PegWindow {
  window: string;
  sample_count: number;
  mean_price: number;
  stddev_price: number;
  min_price: number;
  max_price: number;
  max_deviation_bps: number;
  seconds_outside_10bps: number;
  seconds_outside_50bps: number;
}

function formatDuration(seconds: number): string {
  if (seconds === 0) return "0s";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h`;
}

function PegHistoricalStats({ address }: { address: string }) {
  const [windows, setWindows] = useState<PegWindow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/v1/stablecoins/${address}/peg`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setWindows(data.windows ?? []);
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [address]);

  if (loading || windows.length === 0) return null;

  return (
    <motion.div
      variants={fadeUp}
      className="peg-historical-grid"
      style={{
        marginTop: 16,
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 1,
        border: "1px solid var(--color-border-subtle)",
        borderRadius: 8,
        overflow: "hidden",
        background: "var(--color-border-subtle)",
      }}
    >
      {windows.map((w) => (
        <div
          key={w.window}
          style={{
            background: "var(--color-bg-base)",
            padding: "18px 16px",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--color-text-quaternary)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              marginBottom: 12,
            }}
          >
            Last {w.window}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Row label="Mean" value={`$${w.mean_price.toFixed(6)}`} />
            <Row
              label="Stddev"
              value={w.stddev_price === 0 ? "—" : `${(w.stddev_price * 10000).toFixed(2)} bps`}
            />
            <Row
              label="Max drawdown"
              value={`${w.max_deviation_bps.toFixed(2)} bps`}
            />
            <Row
              label="Outside 10bps"
              value={formatDuration(w.seconds_outside_10bps)}
            />
            <Row label="Samples" value={String(w.sample_count)} />
          </div>
        </div>
      ))}
    </motion.div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        fontFamily: "var(--font-mono)",
        fontSize: 11,
      }}
    >
      <span style={{ color: "var(--color-text-quaternary)" }}>{label}</span>
      <span
        style={{
          color: "var(--color-text-primary)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function SupplyCapBar({
  current,
  cap,
  decimals = 6,
}: {
  current: string;
  cap: string;
  decimals?: number;
}) {
  const c = formatSupplyRaw(current, decimals);
  const k = formatSupplyRaw(cap, decimals);
  const pct = k > 0 ? Math.min(100, (c / k) * 100) : 0;

  return (
    <div style={{ width: "100%" }}>
      <div
        style={{
          width: "100%",
          height: 6,
          background: "rgba(255,255,255,0.06)",
          borderRadius: 3,
          overflow: "hidden",
          position: "relative",
        }}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1.0, ease: [0.16, 1, 0.3, 1] as const, delay: 0.15 }}
          style={{
            height: "100%",
            background: "rgba(255,255,255,0.35)",
            borderRadius: 3,
          }}
        />
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 8,
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "var(--color-text-quaternary)",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        <span>{pct.toFixed(1)}% of cap used</span>
        <span>
          {formatSupply(current, decimals)} / {formatSupply(cap, decimals)}
        </span>
      </div>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

interface Peer {
  address: string;
  name: string;
  symbol: string;
  tagline: string | null;
}

interface StablecoinDetailProps {
  token: StablecoinData;
  editorial: StablecoinEditorial | null;
  iconUrl: string | null;
  peers: Peer[];
}

export default function StablecoinDetail({
  token,
  editorial,
  iconUrl,
  peers,
}: StablecoinDetailProps) {
  const isPathUsd = token.symbol === "pathUSD";
  const priceColor = pegDeviationColor(token.price_vs_pathusd);
  const devBps = pegDeviationBps(token.price_vs_pathusd);
  const hasCap = token.supply_cap !== "0" && token.headroom_pct !== -1;
  const currentSupplyNum = formatSupplyRaw(token.current_supply);
  const optedInSupplyNum = formatSupplyRaw(token.opted_in_supply);
  const optedInPct =
    currentSupplyNum > 0 ? (optedInSupplyNum / currentSupplyNum) * 100 : 0;

  // Metric cells
  const metrics = [
    {
      label: "Price vs pathUSD",
      value: isPathUsd ? "1.000000" : token.price_vs_pathusd.toFixed(6),
      color: priceColor,
    },
    {
      label: "Spread",
      value: token.spread_bps > 0 ? `${token.spread_bps} bps` : "—",
      color: "var(--color-text-primary)",
    },
    {
      label: "Supply",
      value: formatSupply(token.current_supply),
      color: "var(--color-text-primary)",
    },
    {
      label: "Headroom",
      value: token.headroom_pct === -1 ? "uncapped" : `${token.headroom_pct.toFixed(1)}%`,
      color: "var(--color-text-primary)",
    },
    {
      label: "Yield",
      value: token.yield_rate > 0 ? `${(token.yield_rate * 100).toFixed(2)}%` : "—",
      color:
        token.yield_rate > 0 ? "var(--color-success)" : "var(--color-text-primary)",
    },
    {
      label: "Currency",
      value: token.currency,
      color: "var(--color-text-primary)",
    },
  ];

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "64px 48px 96px" }}>
      {/* Breadcrumb */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "var(--color-text-quaternary)",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          marginBottom: 32,
          display: "flex",
          gap: 6,
          alignItems: "center",
        }}
      >
        <Link
          href="/explorer"
          style={{ color: "var(--color-text-tertiary)", textDecoration: "none" }}
        >
          Explorer
        </Link>
        <span>/</span>
        <span>Stablecoin</span>
        <span>/</span>
        <span style={{ color: "var(--color-text-secondary)" }}>
          {token.symbol}
        </span>
      </motion.div>

      {/* ═══ HERO ═══ */}
      <motion.section
        initial="hidden"
        animate="visible"
        variants={stagger}
        style={{ marginBottom: 56 }}
      >
        <motion.div
          variants={fadeUp}
          style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}
        >
          {iconUrl ? (
            <img
              src={iconUrl}
              alt=""
              width={48}
              height={48}
              style={{ borderRadius: "50%", flexShrink: 0 }}
            />
          ) : (
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: "var(--color-bg-emphasis)",
                color: "var(--color-text-tertiary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
                fontWeight: 600,
                fontFamily: "var(--font-mono)",
              }}
            >
              {token.symbol.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: "var(--color-text-quaternary)",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              {token.name}
            </div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 18,
                fontWeight: 500,
                color: "var(--color-text-primary)",
                letterSpacing: "-0.01em",
              }}
            >
              {token.symbol}
            </div>
          </div>
        </motion.div>

        <motion.div
          variants={fadeUp}
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "var(--color-text-tertiary)",
            marginBottom: 32,
            wordBreak: "break-all",
          }}
        >
          {token.address}
        </motion.div>

        {editorial?.tagline && (
          <motion.h1
            variants={fadeUp}
            className="stable-hero-h1"
            style={{
              fontFamily: "'Instrument Serif', Georgia, serif",
              fontSize: 44,
              fontWeight: 400,
              lineHeight: 1.15,
              letterSpacing: "-0.02em",
              color: "var(--color-text-primary)",
              marginBottom: 36,
              maxWidth: 780,
            }}
          >
            {editorial.tagline}
          </motion.h1>
        )}

        {/* Current price prominently displayed */}
        <motion.div variants={fadeUp} style={{ marginBottom: 36 }}>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--color-text-quaternary)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              marginBottom: 6,
            }}
          >
            Current price
          </div>
          <div
            className="stable-price"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 48,
              fontWeight: 500,
              color: priceColor,
              letterSpacing: "-0.02em",
              fontVariantNumeric: "tabular-nums",
              lineHeight: 1,
              display: "flex",
              alignItems: "baseline",
              gap: 12,
            }}
          >
            {isPathUsd
              ? "$1.000000"
              : `$${token.price_vs_pathusd.toFixed(6)}`}
            {!isPathUsd && devBps !== 0 && (
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 14,
                  color: "var(--color-text-tertiary)",
                  letterSpacing: "0.04em",
                }}
              >
                {devBps > 0 ? "+" : ""}
                {devBps} bps vs $1
              </span>
            )}
          </div>
        </motion.div>

        {/* Metrics row — 6 outlined cells */}
        <motion.div
          variants={fadeUp}
          className="stablecoin-metric-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(6, 1fr)",
            gap: 8,
          }}
        >
          {metrics.map((m) => (
            <div
              key={m.label}
              style={{
                border: "1px solid var(--color-border-subtle)",
                borderRadius: 8,
                padding: 16,
                background: "transparent",
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  fontWeight: 500,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "var(--color-text-quaternary)",
                  marginBottom: 8,
                }}
              >
                {m.label}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 15,
                  fontWeight: 500,
                  color: m.color,
                  fontVariantNumeric: "tabular-nums",
                  letterSpacing: "-0.01em",
                }}
              >
                {m.value}
              </div>
            </div>
          ))}
        </motion.div>
      </motion.section>

      {/* ═══ 01: ORIGIN ═══ */}
      <Section>
        <SectionRule />
        <SectionNumber>01 — Origin</SectionNumber>
        <SectionHeadline>Where it comes from</SectionHeadline>
        <div
          className="stable-origin-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) 260px",
            gap: 40,
            alignItems: "start",
          }}
        >
          <BodyProse>
            {editorial ? (
              <p style={{ margin: 0 }}>{editorial.origin}</p>
            ) : (
              <p style={{ margin: 0, color: "var(--color-text-tertiary)" }}>
                Editorial context is not yet available for this stablecoin.
              </p>
            )}
          </BodyProse>
          <DataCard>
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  fontWeight: 500,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "var(--color-text-quaternary)",
                  marginBottom: 6,
                }}
              >
                Issuer
              </div>
              <div
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: 14,
                  color: "var(--color-text-primary)",
                  fontWeight: 500,
                }}
              >
                {editorial?.issuer ?? "Unknown"}
              </div>
              {editorial?.issuerUrl && (
                <a
                  href={editorial.issuerUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    color: "var(--color-text-tertiary)",
                    textDecoration: "none",
                    marginTop: 4,
                    display: "inline-block",
                    borderBottom: "1px solid var(--color-border-subtle)",
                  }}
                >
                  {editorial.issuerUrl.replace(/^https?:\/\//, "")} ↗
                </a>
              )}
            </div>
            <div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  fontWeight: 500,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "var(--color-text-quaternary)",
                  marginBottom: 8,
                }}
              >
                Backing type
              </div>
              {editorial?.backingType && <BackingBadge type={editorial.backingType} />}
            </div>
          </DataCard>
        </div>
      </Section>

      {/* ═══ 02: PEG HEALTH ═══ */}
      <Section>
        <SectionRule />
        <SectionNumber>02 — Peg Health</SectionNumber>
        <SectionHeadline>Peg stability</SectionHeadline>
        <BodyProse>
          <p style={{ marginBottom: 20 }}>
            {isPathUsd ? (
              <>
                pathUSD is the enshrined quote token — every swap on Tempo prices against it.
                Its peg is maintained by redemption against other pegged TIP-20 stablecoins via
                the protocol DEX.
              </>
            ) : (
              <>
                {token.symbol} trades at{" "}
                <strong
                  style={{ color: "var(--color-text-primary)", fontWeight: 500 }}
                >
                  ${token.price_vs_pathusd.toFixed(6)}
                </strong>{" "}
                against pathUSD —{" "}
                <span style={{ color: priceColor, fontWeight: 500 }}>
                  {devBps === 0
                    ? "perfectly pegged"
                    : `${Math.abs(devBps)} bps ${devBps > 0 ? "above" : "below"}`}
                </span>{" "}
                the $1.00 anchor. Spread on the enshrined DEX is{" "}
                <strong
                  style={{ color: "var(--color-text-primary)", fontWeight: 500 }}
                >
                  {token.spread_bps > 0 ? `${token.spread_bps} bps` : "tight"}
                </strong>
                .
              </>
            )}
          </p>
        </BodyProse>

        <motion.div
          variants={fadeUp}
          style={{
            marginTop: 32,
            padding: "28px 24px 20px",
            border: "1px solid var(--color-border-subtle)",
            borderRadius: 8,
            background: "var(--color-bg-subtle)",
          }}
        >
          <PegSparkline price={token.price_vs_pathusd} />
          <div
            className="stable-peg-health"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 8,
              marginTop: 20,
              paddingTop: 16,
              borderTop: "1px solid var(--color-border-subtle)",
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  color: "var(--color-text-quaternary)",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  marginBottom: 4,
                }}
              >
                Deviation
              </div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 14,
                  color: priceColor,
                  fontVariantNumeric: "tabular-nums",
                  fontWeight: 500,
                }}
              >
                {devBps === 0 ? "0 bps" : `${devBps > 0 ? "+" : ""}${devBps} bps`}
              </div>
            </div>
            <div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  color: "var(--color-text-quaternary)",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  marginBottom: 4,
                }}
              >
                DEX Spread
              </div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 14,
                  color: "var(--color-text-primary)",
                  fontVariantNumeric: "tabular-nums",
                  fontWeight: 500,
                }}
              >
                {token.spread_bps > 0 ? `${token.spread_bps} bps` : "—"}
              </div>
            </div>
            <div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  color: "var(--color-text-quaternary)",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  marginBottom: 4,
                }}
              >
                Status
              </div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 14,
                  color: priceColor,
                  fontVariantNumeric: "tabular-nums",
                  fontWeight: 500,
                }}
              >
                {Math.abs(token.price_vs_pathusd - 1) < 0.001
                  ? "tight"
                  : Math.abs(token.price_vs_pathusd - 1) < 0.005
                    ? "mild drift"
                    : "notable"}
              </div>
            </div>
          </div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--color-text-quaternary)",
              letterSpacing: "0.04em",
              marginTop: 14,
              textTransform: "uppercase",
            }}
          >
            Simulated trace — historical peg series coming soon
          </div>
        </motion.div>

        <PegHistoricalStats address={token.address} />
      </Section>

      {/* ═══ 03: SUPPLY ═══ */}
      <Section>
        <SectionRule />
        <SectionNumber>03 — Supply</SectionNumber>
        <SectionHeadline>Supply &amp; dynamics</SectionHeadline>
        <BodyProse>
          <p style={{ marginBottom: 20 }}>
            Current circulating supply is{" "}
            <strong style={{ color: "var(--color-text-primary)", fontWeight: 500 }}>
              {formatSupply(token.current_supply)}
            </strong>
            .{" "}
            {hasCap ? (
              <>
                The TIP-403 policy caps issuance at{" "}
                <strong
                  style={{ color: "var(--color-text-primary)", fontWeight: 500 }}
                >
                  {formatSupply(token.supply_cap)}
                </strong>
                , leaving{" "}
                <strong
                  style={{ color: "var(--color-text-primary)", fontWeight: 500 }}
                >
                  {token.headroom_pct.toFixed(1)}%
                </strong>{" "}
                of headroom before new mints are blocked at the protocol level.
              </>
            ) : (
              <>
                This stablecoin has no supply cap — issuance is constrained only by the issuer,
                not enforced at the protocol layer.
              </>
            )}
          </p>
        </BodyProse>

        <DataCard style={{ marginTop: 32, padding: "24px 24px 20px" }}>
          {hasCap && (
            <div style={{ marginBottom: 20 }}>
              <SupplyCapBar
                current={token.current_supply}
                cap={token.supply_cap}
              />
            </div>
          )}
          <DataRow
            label="Current supply"
            value={formatSupply(token.current_supply)}
          />
          <DataRow
            label="Supply cap"
            value={hasCap ? formatSupply(token.supply_cap) : "uncapped"}
          />
          <DataRow
            label="Headroom"
            value={
              token.headroom_pct === -1
                ? "uncapped"
                : `${token.headroom_pct.toFixed(1)}%`
            }
          />
          <DataRow
            label="Opted-in supply"
            value={
              optedInSupplyNum > 0
                ? `${formatSupply(token.opted_in_supply)} (${optedInPct.toFixed(1)}%)`
                : "—"
            }
          />
        </DataCard>
      </Section>

      {/* ═══ 04: COMPLIANCE ═══ */}
      <Section>
        <SectionRule />
        <SectionNumber>04 — Compliance</SectionNumber>
        <SectionHeadline>Compliance &amp; controls</SectionHeadline>
        <BodyProse>
          <p style={{ marginBottom: 20 }}>
            Every TIP-20 stablecoin on Tempo is governed by a{" "}
            <strong style={{ color: "var(--color-text-primary)", fontWeight: 500 }}>
              TIP-403 policy
            </strong>
            {" "}— the enshrined compliance registry at{" "}
            <code
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 13,
                color: "var(--color-text-secondary)",
                background: "var(--color-bg-subtle)",
                padding: "1px 6px",
                borderRadius: 3,
              }}
            >
              0x403c…0000
            </code>
            . The policy controls which addresses can hold, transfer, and mint.
          </p>
        </BodyProse>

        <DataCard style={{ marginTop: 32 }}>
          <DataRow
            label="Policy ID"
            value={token.policy_id > 0 ? `#${token.policy_id}` : "—"}
          />
          <DataRow label="Policy type" value={token.policy_type || "—"} />
          <DataRow
            label="Policy admin"
            value={
              token.policy_admin ? (
                <span title={token.policy_admin}>
                  {truncate(token.policy_admin)}
                </span>
              ) : (
                "—"
              )
            }
          />
          <DataRow
            label="Registry"
            value={
              <span title="TIP-403 compliance registry">0x403c…0000</span>
            }
          />
        </DataCard>
      </Section>

      {/* ═══ 05: BACKING & RISKS ═══ */}
      <Section>
        <SectionRule />
        <SectionNumber>05 — Backing &amp; risks</SectionNumber>
        <SectionHeadline>
          What backs it. What could go wrong.
        </SectionHeadline>
        <BodyProse>
          <p style={{ marginBottom: 24 }}>
            {editorial?.backing ??
              "Backing structure has not been documented for this stablecoin."}
          </p>
        </BodyProse>

        <ReservesPanel address={token.address} />
        <RiskPanel address={token.address} />

        {editorial && editorial.risks.length > 0 && (
          <motion.div variants={fadeUp} style={{ marginTop: 32 }}>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                fontWeight: 500,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "var(--color-text-quaternary)",
                marginBottom: 16,
              }}
            >
              Risks
            </div>
            <ol
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              {editorial.risks.map((risk, i) => (
                <li
                  key={i}
                  style={{
                    display: "flex",
                    gap: 16,
                    alignItems: "flex-start",
                    paddingBottom: 14,
                    borderBottom:
                      i === editorial.risks.length - 1
                        ? "none"
                        : "1px solid var(--color-border-subtle)",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      color: "var(--color-text-quaternary)",
                      letterSpacing: "0.06em",
                      flexShrink: 0,
                      minWidth: 20,
                      paddingTop: 2,
                    }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span
                    style={{
                      fontSize: 15,
                      lineHeight: 1.65,
                      color: "var(--color-text-secondary)",
                    }}
                  >
                    {risk}
                  </span>
                </li>
              ))}
            </ol>
          </motion.div>
        )}

        {editorial && editorial.notable.length > 0 && (
          <motion.div variants={fadeUp} style={{ marginTop: 40 }}>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                fontWeight: 500,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "var(--color-text-quaternary)",
                marginBottom: 16,
              }}
            >
              Notable
            </div>
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              {editorial.notable.map((note, i) => (
                <li
                  key={i}
                  style={{
                    display: "flex",
                    gap: 14,
                    alignItems: "flex-start",
                  }}
                >
                  <span
                    style={{
                      color: "var(--color-success)",
                      fontSize: 13,
                      flexShrink: 0,
                      paddingTop: 3,
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    ✓
                  </span>
                  <span
                    style={{
                      fontSize: 15,
                      lineHeight: 1.65,
                      color: "var(--color-text-secondary)",
                    }}
                  >
                    {note}
                  </span>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </Section>

      {/* ═══ CTA ═══ */}
      <Section style={{ marginTop: 56 }}>
        <div
          style={{
            height: 1,
            background:
              "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)",
            margin: "64px 0 48px",
          }}
        />
        <motion.div variants={fadeUp} style={{ marginBottom: 32 }}>
          <Link
            href="/explorer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 18px",
              border: "1px solid var(--color-border-default)",
              borderRadius: 6,
              fontFamily: "var(--font-sans)",
              fontSize: 13,
              fontWeight: 500,
              color: "var(--color-text-primary)",
              textDecoration: "none",
              background: "var(--color-bg-subtle)",
              transition: "background 150ms ease",
            }}
          >
            <span style={{ fontSize: 14 }}>←</span>
            View in flow diagram
          </Link>
        </motion.div>

        {peers.length > 0 && (
          <motion.div variants={fadeUp}>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                fontWeight: 500,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "var(--color-text-quaternary)",
                marginBottom: 20,
              }}
            >
              Analyze another stablecoin
            </div>
            <div
              className="stablecoin-peer-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: 1,
                background: "var(--color-border-subtle)",
                borderRadius: 8,
                overflow: "hidden",
              }}
            >
              {peers.map((peer) => (
                <Link
                  key={peer.address}
                  href={`/explorer/stablecoin/${peer.address}`}
                  style={{
                    background: "var(--color-bg-subtle)",
                    padding: "16px 18px",
                    textDecoration: "none",
                    color: "inherit",
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                    transition: "background 150ms ease",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background =
                      "rgba(255,255,255,0.05)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background =
                      "var(--color-bg-subtle)";
                  }}
                >
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 13,
                      fontWeight: 500,
                      color: "var(--color-text-primary)",
                    }}
                  >
                    {peer.symbol}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--color-text-tertiary)",
                      lineHeight: 1.5,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {peer.tagline ?? peer.name}
                  </div>
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </Section>

      {/* Responsive rules */}
      <style>{`
        @media (max-width: 720px) {
          .stablecoin-metric-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          .stablecoin-origin-grid {
            grid-template-columns: 1fr !important;
          }
          .stablecoin-peer-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
