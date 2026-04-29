"use client";

import { useMemo } from "react";
import {
  ComposedChart,
  Area,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { TOKEN_COLORS } from "@/lib/oli/tokens";
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
const ACCENT_DIM = "rgba(96, 128, 192, 0.55)";

function fmtUsd(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "$0";
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(2)}`;
}

function fmtTickX(ts: number, bucketHours: number): string {
  const d = new Date(ts);
  if (bucketHours <= 1) {
    return `${String(d.getUTCHours()).padStart(2, "0")}:00`;
  }
  if (bucketHours <= 6) {
    return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })} ${String(d.getUTCHours()).padStart(2, "0")}:00`;
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
  height = 280,
}: {
  points: TokenStackPoint[];
  totals: TokenStackTotals;
  bucketHours?: number;
  height?: number;
}) {
  const grandTotal = totals.usdce + totals.usdt0 + totals.other;

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
          fontSize: 12,
          color: "var(--color-text-quaternary)",
          border: "1px solid var(--color-border-subtle)",
          borderRadius: 8,
          background: "var(--color-bg-subtle)",
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
    <div className="oli-tokenchart" style={{ width: "100%" }}>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart
          data={data}
          margin={{ top: 12, right: 12, bottom: 4, left: 0 }}
        >
          <defs>
            <pattern
              id="oli-other-pattern"
              width="6"
              height="6"
              patternUnits="userSpaceOnUse"
            >
              <rect width="6" height="6" fill="rgba(255,255,255,0.06)" />
              <circle cx="1.5" cy="1.5" r="0.7" fill="rgba(255,255,255,0.35)" />
            </pattern>
            <linearGradient id="oli-usdce-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(255,255,255,0.55)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.10)" />
            </linearGradient>
            <linearGradient id="oli-usdt0-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={ACCENT_DIM} />
              <stop offset="100%" stopColor="rgba(96,128,192,0.10)" />
            </linearGradient>
          </defs>

          <CartesianGrid
            stroke="rgba(255,255,255,0.06)"
            strokeDasharray="2 4"
            vertical={false}
          />

          <XAxis
            dataKey="ts"
            type="number"
            domain={["dataMin", "dataMax"]}
            scale="time"
            tickFormatter={(v) => fmtTickX(v, bucketHours)}
            stroke="rgba(255,255,255,0.18)"
            tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 10, fontFamily: "var(--font-mono)" }}
            tickLine={{ stroke: "rgba(255,255,255,0.10)" }}
            axisLine={{ stroke: "rgba(255,255,255,0.10)" }}
            minTickGap={32}
          />

          <YAxis
            yAxisId="usd"
            orientation="left"
            tickFormatter={fmtUsd}
            stroke="rgba(255,255,255,0.18)"
            tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 10, fontFamily: "var(--font-mono)" }}
            tickLine={false}
            axisLine={false}
            width={56}
          />

          <YAxis
            yAxisId="tx"
            orientation="right"
            tickFormatter={(v) => `${v}`}
            stroke="rgba(255,255,255,0.18)"
            tick={{ fill: "rgba(255,255,255,0.30)", fontSize: 10, fontFamily: "var(--font-mono)" }}
            tickLine={false}
            axisLine={false}
            width={32}
          />

          <Tooltip
            cursor={{ stroke: ACCENT, strokeDasharray: "3 3", strokeWidth: 1 }}
            content={(props) => <CustomTooltip {...props} />}
          />

          <Bar
            yAxisId="tx"
            dataKey="txCount"
            fill="rgba(255,255,255,0.10)"
            stroke="rgba(255,255,255,0.16)"
            strokeWidth={0.5}
            isAnimationActive
            animationDuration={700}
            animationEasing="ease-out"
            radius={[2, 2, 0, 0]}
          />

          <Area
            yAxisId="usd"
            type="monotone"
            dataKey="other"
            stackId="rev"
            fill="url(#oli-other-pattern)"
            stroke="rgba(255,255,255,0.30)"
            strokeWidth={0.75}
            isAnimationActive
            animationDuration={900}
            animationEasing="ease-out"
          />
          <Area
            yAxisId="usd"
            type="monotone"
            dataKey="usdt0"
            stackId="rev"
            fill="url(#oli-usdt0-grad)"
            stroke={ACCENT}
            strokeWidth={1}
            isAnimationActive
            animationDuration={900}
            animationEasing="ease-out"
          />
          <Area
            yAxisId="usd"
            type="monotone"
            dataKey="usdce"
            stackId="rev"
            fill="url(#oli-usdce-grad)"
            stroke="rgba(255,255,255,0.85)"
            strokeWidth={1}
            isAnimationActive
            animationDuration={900}
            animationEasing="ease-out"
          />

          <Line
            yAxisId="usd"
            type="monotone"
            dataKey="ma"
            stroke={ACCENT}
            strokeWidth={1.25}
            strokeDasharray="3 3"
            dot={false}
            activeDot={false}
            isAnimationActive
            animationDuration={1100}
            animationEasing="ease-out"
            connectNulls
          />

          <Legend
            verticalAlign="bottom"
            height={28}
            iconType="square"
            iconSize={8}
            wrapperStyle={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--color-text-tertiary)",
              paddingTop: 4,
            }}
            formatter={(value) => {
              const map: Record<string, string> = {
                usdce: "USDC.e",
                usdt0: "USDT0",
                other: "other",
                txCount: "tx count",
                ma: "ma · 7",
              };
              return map[value] ?? value;
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// Custom tooltip — mono fixed-width numerals, accent left rule, bucket header.
// Recharts' tooltip payload entries have a wider dataKey type than we use; we
// only read .payload (the row datum), so we accept any-shape entries.
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

  const rows: Array<{ key: string; label: string; value: string; sub?: string; swatch: string }> = [
    {
      key: "usdce",
      label: "USDC.e",
      value: fmtUsd(d.usdce),
      sub: pct(d.usdce),
      swatch: TOKEN_COLORS["USDC.e"],
    },
    {
      key: "usdt0",
      label: "USDT0",
      value: fmtUsd(d.usdt0),
      sub: pct(d.usdt0),
      swatch: TOKEN_COLORS.USDT0,
    },
    {
      key: "other",
      label: "other",
      value: fmtUsd(d.other),
      sub: pct(d.other),
      swatch: TOKEN_COLORS.other,
    },
  ];

  return (
    <div className="oli-tokenchart-tip">
      <div className="oli-tokenchart-tip-head">{d.bucketLabel}</div>
      <div className="oli-tokenchart-tip-rows">
        {rows.map((r) => (
          <div key={r.key} className="oli-tokenchart-tip-row">
            <span className="oli-tokenchart-tip-swatch" style={{ background: r.swatch }} />
            <span className="oli-tokenchart-tip-label">{r.label}</span>
            <span className="oli-tokenchart-tip-value">{r.value}</span>
            <span className="oli-tokenchart-tip-sub">{r.sub}</span>
          </div>
        ))}
        <div className="oli-tokenchart-tip-divider" />
        <div className="oli-tokenchart-tip-row">
          <span className="oli-tokenchart-tip-swatch oli-tokenchart-tip-swatch-blank" />
          <span className="oli-tokenchart-tip-label">total</span>
          <span className="oli-tokenchart-tip-value oli-tokenchart-tip-value-strong">{fmtUsd(total)}</span>
          <span className="oli-tokenchart-tip-sub" />
        </div>
        <div className="oli-tokenchart-tip-row">
          <span className="oli-tokenchart-tip-swatch oli-tokenchart-tip-swatch-blank" />
          <span className="oli-tokenchart-tip-label">tx count</span>
          <span className="oli-tokenchart-tip-value">{d.txCount.toLocaleString()}</span>
          <span className="oli-tokenchart-tip-sub" />
        </div>
        {d.ma != null && (
          <div className="oli-tokenchart-tip-row">
            <span className="oli-tokenchart-tip-swatch oli-tokenchart-tip-swatch-ma" />
            <span className="oli-tokenchart-tip-label">ma · 7</span>
            <span className="oli-tokenchart-tip-value">{fmtUsd(d.ma)}</span>
            <span className="oli-tokenchart-tip-sub" />
          </div>
        )}
      </div>
    </div>
  );
}
