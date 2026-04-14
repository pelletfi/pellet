import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { enqueueWebhookEvent } from "./webhook-deliver";

// Window we score (latest hour, bucketed in 15-min slices)
const WINDOW_MINUTES = 15;
const BASELINE_DAYS = 7;
const Z_THRESHOLD = 3.0;

interface BaselineRow {
  from_token: string;
  to_token: string;
  mean_usd: number;
  stddev_usd: number;
  observation_count: number;
}

interface ObservedRow {
  from_token: string;
  to_token: string;
  window_start: string;
  observed_usd: number;
  tx_count: number;
}

export interface DetectResult {
  edgesScanned: number;
  anomaliesFound: number;
}

export async function detectFlowAnomalies(): Promise<DetectResult> {
  // Compute the most recent COMPLETE 15-min window
  // We use stablecoin_flows (which is bucketed by hour); for finer granularity
  // we'd need raw transfer events. For v1 this is OK.
  const winRes = await db.execute(sql`
    SELECT
      from_token,
      to_token,
      DATE_TRUNC('hour', hour) AS window_start,
      SUM(net_flow_usd::float8) AS observed_usd,
      SUM(tx_count) AS tx_count
    FROM stablecoin_flows
    WHERE hour >= NOW() - INTERVAL '${sql.raw(String(WINDOW_MINUTES))} minutes'
    GROUP BY from_token, to_token, DATE_TRUNC('hour', hour)
  `);
  const observed = ((winRes as unknown as { rows?: Record<string, unknown>[] }).rows
    ?? (winRes as unknown as Record<string, unknown>[])) as unknown as ObservedRow[];
  if (observed.length === 0) return { edgesScanned: 0, anomaliesFound: 0 };

  // Compute 7-day baseline per edge
  const baseRes = await db.execute(sql`
    SELECT
      from_token,
      to_token,
      AVG(net_flow_usd::float8) AS mean_usd,
      STDDEV(net_flow_usd::float8) AS stddev_usd,
      COUNT(*) AS observation_count
    FROM stablecoin_flows
    WHERE hour >= NOW() - INTERVAL '${sql.raw(String(BASELINE_DAYS))} days'
      AND hour < NOW() - INTERVAL '${sql.raw(String(WINDOW_MINUTES))} minutes'
    GROUP BY from_token, to_token
    HAVING COUNT(*) >= 10
  `);
  const baselines = ((baseRes as unknown as { rows?: Record<string, unknown>[] }).rows
    ?? (baseRes as unknown as Record<string, unknown>[])) as unknown as BaselineRow[];

  const baselineByKey = new Map<string, BaselineRow>();
  for (const b of baselines) {
    baselineByKey.set(`${b.from_token}:${b.to_token}`, b);
  }

  let anomaliesFound = 0;
  for (const o of observed) {
    const key = `${o.from_token}:${o.to_token}`;
    const base = baselineByKey.get(key);
    if (!base) continue;
    const stddev = Number(base.stddev_usd) || 0;
    if (stddev === 0) continue;
    const observedUsd = Number(o.observed_usd);
    const meanUsd = Number(base.mean_usd);
    const z = (observedUsd - meanUsd) / stddev;
    if (Math.abs(z) < Z_THRESHOLD) continue;

    const winEnd = new Date(new Date(o.window_start).getTime() + WINDOW_MINUTES * 60 * 1000).toISOString();

    // Insert; conflict on (from, to, window_start) skips duplicates
    const insert = await db.execute(sql`
      INSERT INTO flow_anomalies (
        from_token, to_token, window_start, window_end,
        observed_flow_usd, baseline_mean_usd, baseline_stddev_usd, z_score, tx_count
      ) VALUES (
        ${o.from_token}, ${o.to_token}, ${o.window_start}, ${winEnd},
        ${observedUsd.toFixed(2)}, ${meanUsd.toFixed(2)}, ${stddev.toFixed(2)},
        ${z.toFixed(3)}, ${o.tx_count}
      )
      ON CONFLICT (from_token, to_token, window_start) DO NOTHING
      RETURNING id
    `);
    const inserted = (((insert as unknown as { rows?: Record<string, unknown>[] }).rows
      ?? (insert as unknown as Record<string, unknown>[])) as unknown as Array<{ id: number }>);
    if (inserted.length > 0) {
      anomaliesFound += 1;
      await enqueueWebhookEvent("flow_anomaly.detected", {
        from_token: o.from_token,
        to_token: o.to_token,
        window_start: o.window_start,
        window_end: winEnd,
        observed_usd: observedUsd,
        baseline_mean_usd: meanUsd,
        z_score: z,
        tx_count: o.tx_count,
      }, o.from_token);
    }
  }

  return {
    edgesScanned: observed.length,
    anomaliesFound,
  };
}
