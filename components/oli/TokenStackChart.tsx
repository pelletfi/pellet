"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  ReferenceLine,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { TokenStackPoint, TokenStackTotals } from "@/lib/oli/queries";

type Datum = {
  ts: number;
  bucketLabel: string;
  usdce: number;
  usdt0: number;
  other: number;
  total: number;
  txCount: number;
  ma: number | null;
};

const MA_WINDOW = 7;
const ACCENT = "#6080c0";
const FILL_USDCE = "rgba(255, 255, 255, 0.78)";
const FILL_USDT0 = "rgba(96, 128, 192, 0.78)";
const FILL_OTHER = "rgba(255, 255, 255, 0.22)";

function fmtUsd(n: number, compact = true): string {
  if (!Number.isFinite(n) || n === 0) return "$0";
  if (compact) {
    if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
    if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
    return `$${n.toFixed(2)}`;
  }
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function fmtTickX(ts: number, bucketHours: number): string {
  const d = new Date(ts);
  if (bucketHours <= 1) {
    return `${String(d.getUTCHours()).padStart(2, "0")}:00`;
  }
  if (bucketHours <= 6) {
    return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`;
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function fmtBucketFull(ts: number, bucketHours: number): string {
  const d = new Date(ts);
  const day = d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  if (bucketHours <= 24) {
    const h = String(d.getUTCHours()).padStart(2, "0");
    return `${day} · ${h}:00 UTC`;
  }
  return `${day} UTC`;
}

export function TokenStackChart({
  points,
  totals,
  bucketHours = 1,
  height = 260,
}: {
  points: TokenStackPoint[];
  totals: TokenStackTotals;
  bucketHours?: number;
  height?: number;
}) {
  const grandTotal = totals.usdce + totals.usdt0 + totals.other;
  const totalTx = points.reduce((acc, p) => acc + p.txCount, 0);

  // Cap bar width so the first bucket doesn't visually dominate when there
  // are only a handful of points. We also clamp by viewport width so 30
  // buckets at fixed barSize=8 don't overflow on a 320px screen.
  const [viewport, setViewport] = useState<number>(1200);
  useEffect(() => {
    const update = () => setViewport(window.innerWidth);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  const baseBarSize =
    points.length <= 8 ? 14 : points.length <= 16 ? 10 : points.length <= 32 ? 8 : 6;
  // Bars touch (barCategoryGap=0); fully consume each lane on tight screens.
  const widthBudget = Math.max(160, Math.floor(viewport * 0.6));
  const maxBarFromWidth = Math.max(2, Math.floor(widthBudget / Math.max(points.length, 1)));
  const barSize = Math.min(baseBarSize, maxBarFromWidth);

  const data: Datum[] = useMemo(() => {
    return points.map((p, i) => {
      const total = p.usdce + p.usdt0 + p.other;
      const start = Math.max(0, i - MA_WINDOW + 1);
      const window = points.slice(start, i + 1);
      const ma =
        window.length === 0
          ? null
          : window.reduce((acc, w) => acc + w.usdce + w.usdt0 + w.other, 0) /
            window.length;
      return {
        ts: p.bucket.getTime(),
        bucketLabel: fmtBucketFull(p.bucket.getTime(), bucketHours),
        usdce: p.usdce,
        usdt0: p.usdt0,
        other: p.other,
        total,
        txCount: p.txCount,
        ma,
      };
    });
  }, [points, bucketHours]);

  if (points.length < 2 || grandTotal === 0) {
    return (
      <div
        style={{
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 11,
          color: "var(--color-text-quaternary)",
          border: "1px solid var(--color-border-subtle)",
          background: "transparent",
          fontFamily: "var(--font-mono)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        not enough data yet
      </div>
    );
  }

  return (
    <div className="oli-tokenchart">
      <div className="oli-tokenchart-tape">
        <span className="oli-tokenchart-tape-cell">
          <span className="oli-tokenchart-tape-mark" data-token="usdce" />
          <span className="oli-tokenchart-tape-label">USDC.e</span>
          <span className="oli-tokenchart-tape-value">{fmtUsd(totals.usdce)}</span>
        </span>
        <span className="oli-tokenchart-tape-sep" aria-hidden="true">·</span>
        <span className="oli-tokenchart-tape-cell">
          <span className="oli-tokenchart-tape-mark" data-token="usdt0" />
          <span className="oli-tokenchart-tape-label">USDT0</span>
          <span className="oli-tokenchart-tape-value">{fmtUsd(totals.usdt0)}</span>
        </span>
        <span className="oli-tokenchart-tape-sep" aria-hidden="true">·</span>
        <span className="oli-tokenchart-tape-cell">
          <span className="oli-tokenchart-tape-mark" data-token="other" />
          <span className="oli-tokenchart-tape-label">other</span>
          <span className="oli-tokenchart-tape-value">{fmtUsd(totals.other)}</span>
        </span>
        <span className="oli-tokenchart-tape-spacer" />
        <span className="oli-tokenchart-tape-cell">
          <span className="oli-tokenchart-tape-label">txs</span>
          <span className="oli-tokenchart-tape-value">{totalTx.toLocaleString()}</span>
        </span>
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart
          data={data}
          margin={{ top: 8, right: 8, bottom: 4, left: 0 }}
          barCategoryGap={0}
        >
          <XAxis
            dataKey="ts"
            type="number"
            domain={["dataMin", "dataMax"]}
            scale="time"
            tickFormatter={(v) => fmtTickX(v, bucketHours)}
            stroke="rgba(255,255,255,0.10)"
            tick={{ fill: "rgba(255,255,255,0.46)", fontSize: 9, fontFamily: "var(--font-mono)" }}
            tickLine={false}
            axisLine={false}
            minTickGap={48}
            padding={{ left: 28, right: 28 }}
          />

          <YAxis
            tickFormatter={(v) => fmtUsd(v, true)}
            stroke="rgba(255,255,255,0.10)"
            tick={{ fill: "rgba(255,255,255,0.46)", fontSize: 9, fontFamily: "var(--font-mono)" }}
            tickLine={false}
            axisLine={false}
            width={56}
            tickCount={3}
          />

          {/* 1px baseline anchors empty buckets — without it the timeline reads
            * as missing rather than zero. */}
          <ReferenceLine y={0} stroke="rgba(255,255,255,0.10)" strokeWidth={1} />

          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
            wrapperStyle={{ outline: "none" }}
            content={(props) => <CustomTooltip {...props} />}
          />

          <Bar
            dataKey="other"
            stackId="rev"
            fill={FILL_OTHER}
            barSize={barSize}
            minPointSize={1}
            isAnimationActive
            animationDuration={650}
            animationEasing="ease-out"
          />
          <Bar
            dataKey="usdt0"
            stackId="rev"
            fill={FILL_USDT0}
            barSize={barSize}
            minPointSize={1}
            isAnimationActive
            animationDuration={650}
            animationEasing="ease-out"
          />
          <Bar
            dataKey="usdce"
            stackId="rev"
            fill={FILL_USDCE}
            barSize={barSize}
            minPointSize={1}
            isAnimationActive
            animationDuration={650}
            animationEasing="ease-out"
          />

          <Line
            type="step"
            dataKey="ma"
            stroke={ACCENT}
            strokeWidth={1}
            dot={false}
            activeDot={false}
            isAnimationActive
            animationDuration={900}
            animationEasing="ease-out"
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// Hairline tooltip — no shadow, no swatches, mono columns. The bucket header
// reads on top; values stack vertically with right-aligned numerals.
type TooltipEntry = { payload?: Datum };
function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<TooltipEntry>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  const total = d.total;
  const pct = (v: number) => (total > 0 ? `${((v / total) * 100).toFixed(0)}%` : "—");

  return (
    <div className="oli-tokenchart-tip">
      <div className="oli-tokenchart-tip-head">{d.bucketLabel}</div>
      <div className="oli-tokenchart-tip-grid">
        <span className="oli-tokenchart-tip-k">USDC.e</span>
        <span className="oli-tokenchart-tip-v">{fmtUsd(d.usdce, false)}</span>
        <span className="oli-tokenchart-tip-p">{pct(d.usdce)}</span>

        <span className="oli-tokenchart-tip-k">USDT0</span>
        <span className="oli-tokenchart-tip-v">{fmtUsd(d.usdt0, false)}</span>
        <span className="oli-tokenchart-tip-p">{pct(d.usdt0)}</span>

        <span className="oli-tokenchart-tip-k">other</span>
        <span className="oli-tokenchart-tip-v">{fmtUsd(d.other, false)}</span>
        <span className="oli-tokenchart-tip-p">{pct(d.other)}</span>

        <span className="oli-tokenchart-tip-rule" />

        <span className="oli-tokenchart-tip-k">total</span>
        <span className="oli-tokenchart-tip-v oli-tokenchart-tip-v-strong">{fmtUsd(d.total, false)}</span>
        <span className="oli-tokenchart-tip-p" />

        <span className="oli-tokenchart-tip-k">txs</span>
        <span className="oli-tokenchart-tip-v">{d.txCount.toLocaleString()}</span>
        <span className="oli-tokenchart-tip-p" />

        {d.ma != null && (
          <>
            <span className="oli-tokenchart-tip-k">ma · 7</span>
            <span className="oli-tokenchart-tip-v">{fmtUsd(d.ma, false)}</span>
            <span className="oli-tokenchart-tip-p" />
          </>
        )}
      </div>
    </div>
  );
}
