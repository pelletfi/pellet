"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  ReferenceLine,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { TokenStackPoint } from "@/lib/oli/queries";

type Datum = {
  ts: number;
  bucketLabel: string;
  txCount: number;
};

const FILL = "rgba(255, 255, 255, 0.55)";

function fmtTickX(ts: number, bucketHours: number): string {
  const d = new Date(ts);
  if (bucketHours <= 1) return `${String(d.getUTCHours()).padStart(2, "0")}:00`;
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

export function TxCountChart({
  points,
  bucketHours = 1,
  height = 260,
}: {
  points: TokenStackPoint[];
  bucketHours?: number;
  height?: number;
}) {
  const totalTx = points.reduce((acc, p) => acc + p.txCount, 0);
  const peakTx = points.reduce((acc, p) => Math.max(acc, p.txCount), 0);

  const [viewport, setViewport] = useState<number>(1200);
  useEffect(() => {
    const update = () => setViewport(window.innerWidth);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  const baseBarSize =
    points.length <= 8 ? 14 : points.length <= 16 ? 10 : points.length <= 32 ? 8 : 6;
  const widthBudget = Math.max(160, Math.floor(viewport * 0.6));
  const maxBarFromWidth = Math.max(2, Math.floor(widthBudget / Math.max(points.length, 1)));
  const barSize = Math.min(baseBarSize, maxBarFromWidth);

  const data: Datum[] = useMemo(
    () =>
      points.map((p) => ({
        ts: p.bucket.getTime(),
        bucketLabel: fmtBucketFull(p.bucket.getTime(), bucketHours),
        txCount: p.txCount,
      })),
    [points, bucketHours],
  );

  if (points.length < 2 || totalTx === 0) {
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
          <span className="oli-tokenchart-tape-label">total</span>
          <span className="oli-tokenchart-tape-value">{totalTx.toLocaleString()}</span>
        </span>
        <span className="oli-tokenchart-tape-sep" aria-hidden="true">·</span>
        <span className="oli-tokenchart-tape-cell">
          <span className="oli-tokenchart-tape-label">peak/bkt</span>
          <span className="oli-tokenchart-tape-value">{peakTx.toLocaleString()}</span>
        </span>
        <span className="oli-tokenchart-tape-spacer" />
        <span className="oli-tokenchart-tape-cell">
          <span className="oli-tokenchart-tape-label">buckets</span>
          <span className="oli-tokenchart-tape-value">{points.length}</span>
        </span>
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 0 }} barCategoryGap={0}>
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
            tickFormatter={(v) => Number(v).toLocaleString()}
            stroke="rgba(255,255,255,0.10)"
            tick={{ fill: "rgba(255,255,255,0.46)", fontSize: 9, fontFamily: "var(--font-mono)" }}
            tickLine={false}
            axisLine={false}
            width={56}
            tickCount={3}
          />
          <ReferenceLine y={0} stroke="rgba(255,255,255,0.10)" strokeWidth={1} />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
            wrapperStyle={{ outline: "none" }}
            content={(props) => <TxTooltip {...props} />}
          />
          <Bar
            dataKey="txCount"
            fill={FILL}
            barSize={barSize}
            minPointSize={1}
            isAnimationActive
            animationDuration={650}
            animationEasing="ease-out"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

type TooltipEntry = { payload?: Datum };
function TxTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<TooltipEntry>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="oli-tokenchart-tip">
      <div className="oli-tokenchart-tip-head">{d.bucketLabel}</div>
      <div className="oli-tokenchart-tip-grid">
        <span className="oli-tokenchart-tip-k">txs</span>
        <span className="oli-tokenchart-tip-v oli-tokenchart-tip-v-strong">
          {d.txCount.toLocaleString()}
        </span>
        <span className="oli-tokenchart-tip-p" />
      </div>
    </div>
  );
}
