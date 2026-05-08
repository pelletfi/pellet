"use client";

import { useEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue } from "framer-motion";
import { formatUsdcAmount, type Delta } from "@/lib/wallet/format";

export type Stat = {
  label: string;
  count: number;
  /** Controls how the animating number is formatted for display. */
  valueType: "integer" | "usdc";
  delta?: Delta;
  hint?: string;
};

function applyFormat(valueType: Stat["valueType"], n: number): string {
  if (valueType === "usdc") {
    return formatUsdcAmount(String(Math.floor(n)), 6);
  }
  return Math.floor(n).toLocaleString("en-US");
}

export function StatStrip({ stats }: { stats: Stat[] }) {
  return (
    <div className="wallet-stat-strip">
      {stats.map((s, i) => (
        <StatCell key={s.label} stat={s} delay={i * 0.08} />
      ))}
    </div>
  );
}

function StatCell({ stat, delay }: { stat: Stat; delay: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const count = useMotionValue(0);
  const [display, setDisplay] = useState(applyFormat(stat.valueType, 0));

  useEffect(() => {
    const controls = animate(count, stat.count, {
      duration: 1.2,
      delay,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => setDisplay(applyFormat(stat.valueType, latest)),
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stat.count, stat.valueType, delay]);

  return (
    <div className="wallet-stat">
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--color-text-quaternary)",
        }}
      >
        {stat.label}
      </span>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 6 }}>
        <motion.span
          ref={ref}
          className="wallet-stat-value"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay, ease: [0.16, 1, 0.3, 1] }}
          style={{
            fontFamily: "'Instrument Serif', Georgia, serif",
            fontStyle: "italic",
            fontWeight: 400,
            fontSize: 40,
            lineHeight: 1,
            letterSpacing: "-0.015em",
            color: "var(--color-text-primary)",
          }}
        >
          {display}
        </motion.span>
        {stat.delta && stat.delta.tone !== "neutral" && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: delay + 0.4 }}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color:
                stat.delta.tone === "positive"
                  ? "var(--color-success)"
                  : "var(--color-error)",
            }}
          >
            {stat.delta.display}
          </motion.span>
        )}
      </div>
      {stat.hint && (
        <span style={{ marginTop: 6, fontSize: 11, color: "var(--color-text-quaternary)" }}>
          {stat.hint}
        </span>
      )}
    </div>
  );
}
