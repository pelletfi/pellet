"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useInView } from "motion/react";

import { useHlStats, type HlStatValue } from "../../lib/hl/useHlStats";

function formatWithCommas(n: number | bigint): string {
  const num = typeof n === "bigint" ? Number(n) : n;
  return Math.round(num).toLocaleString("en-US");
}

function Counter({
  value,
  duration = 1200,
  enterFrom = 0,
}: {
  value: number;
  duration?: number;
  enterFrom?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  const mounted = useRef(false);
  const [display, setDisplay] = useState(() => formatWithCommas(enterFrom));

  useEffect(() => {
    if (!inView) return;
    // first run animates from enterFrom → value; subsequent updates snap (avoid jitter)
    if (!mounted.current) {
      mounted.current = true;
      const controls = animate(enterFrom, value, {
        duration: duration / 1000,
        ease: [0.16, 1, 0.3, 1],
        onUpdate: (v) => setDisplay(formatWithCommas(v)),
      });
      return () => controls.stop();
    }
    setDisplay(formatWithCommas(value));
  }, [inView, value, duration, enterFrom]);

  return <span ref={ref}>{display}</span>;
}

function StatValue({ stat }: { stat: HlStatValue }) {
  if (!stat.available) return <span>—</span>;
  if (stat.value === null) return <span>—</span>;
  return <Counter value={Number(stat.value)} />;
}

function StatSub({ stat, live, awaiting }: { stat: HlStatValue; live: string; awaiting: string }) {
  if (!stat.available) return <span>{awaiting}</span>;
  if (stat.value === null) return <span>Loading</span>;
  return <span>{live}</span>;
}

export function StatsStrip() {
  const stats = useHlStats("mainnet");

  return (
    <section className="stats-strip">
      <div className="stat">
        <span className="label">Network · Block</span>
        <span className="val">
          <StatValue stat={stats.block} />
        </span>
        <span className="delta">
          <StatSub stat={stats.block} live="HyperEVM · Live" awaiting="HyperEVM" />
        </span>
      </div>
      <div className="stat">
        <span className="label">Agents</span>
        <span className="val">
          <StatValue stat={stats.agents} />
        </span>
        <span className="delta">
          <StatSub stat={stats.agents} live="Live" awaiting="Awaiting deploy" />
        </span>
      </div>
      <div className="stat">
        <span className="label">Attestations</span>
        <span className="val">
          <StatValue stat={stats.attestations} />
        </span>
        <span className="delta">
          <StatSub stat={stats.attestations} live="Live" awaiting="Awaiting deploy" />
        </span>
      </div>
      <div className="stat">
        <span className="label">Validations</span>
        <span className="val">
          <StatValue stat={stats.validations} />
        </span>
        <span className="delta">
          <StatSub stat={stats.validations} live="Live" awaiting="Awaiting deploy" />
        </span>
      </div>
    </section>
  );
}
