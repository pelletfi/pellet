import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { KNOWN_STABLECOINS } from "@/lib/pipeline/stablecoins";

interface Window {
  label: string;
  seconds: number;
}

const WINDOWS: Window[] = [
  { label: "1h", seconds: 60 * 60 },
  { label: "24h", seconds: 24 * 60 * 60 },
  { label: "7d", seconds: 7 * 24 * 60 * 60 },
];

export interface AggregateResult {
  computedAt: string;
  stables: number;
  rowsUpserted: number;
}

// For each (stable × window) compute aggregate stats from peg_samples.
// Results written to peg_aggregates (upsert on primary key).
export async function computePegAggregates(): Promise<AggregateResult> {
  const now = new Date();
  let rowsUpserted = 0;

  for (const stable of KNOWN_STABLECOINS) {
    const addr = stable.address.toLowerCase();
    for (const win of WINDOWS) {
      const since = new Date(now.getTime() - win.seconds * 1000);

      // Pull samples in window. price_vs_pathusd and spread_bps are NUMERIC (strings
      // from the driver); cast to double precision for arithmetic.
      const result = await db.execute(sql`
        SELECT
          COUNT(*)::int AS sample_count,
          COALESCE(AVG(price_vs_pathusd::float8), 1) AS mean_price,
          COALESCE(STDDEV(price_vs_pathusd::float8), 0) AS stddev_price,
          COALESCE(MIN(price_vs_pathusd::float8), 1) AS min_price,
          COALESCE(MAX(price_vs_pathusd::float8), 1) AS max_price,
          COALESCE(MAX(spread_bps::float8), 0) AS max_deviation_bps
        FROM peg_samples
        WHERE stable = ${addr}
          AND sampled_at >= ${since.toISOString()}
      `);

      const rows = (result as unknown as { rows?: Record<string, unknown>[] }).rows
        ?? (result as unknown as Record<string, unknown>[]);
      const r = Array.isArray(rows) ? rows[0] : undefined;
      if (!r) continue;

      const sampleCount = Number(r.sample_count ?? 0);
      if (sampleCount === 0) continue;

      // Compute seconds outside 10bps / 50bps by counting samples beyond threshold
      // and multiplying by expected sample interval (~60s from cron cadence).
      const SAMPLE_INTERVAL_SEC = 60;
      const outside10Result = await db.execute(sql`
        SELECT COUNT(*)::int AS c
        FROM peg_samples
        WHERE stable = ${addr}
          AND sampled_at >= ${since.toISOString()}
          AND spread_bps::float8 > 10
      `);
      const outside50Result = await db.execute(sql`
        SELECT COUNT(*)::int AS c
        FROM peg_samples
        WHERE stable = ${addr}
          AND sampled_at >= ${since.toISOString()}
          AND spread_bps::float8 > 50
      `);
      const outside10Rows = (outside10Result as unknown as { rows?: Record<string, unknown>[] }).rows
        ?? (outside10Result as unknown as Record<string, unknown>[]);
      const outside50Rows = (outside50Result as unknown as { rows?: Record<string, unknown>[] }).rows
        ?? (outside50Result as unknown as Record<string, unknown>[]);
      const outside10Count = Number((Array.isArray(outside10Rows) ? outside10Rows[0] : undefined)?.c ?? 0);
      const outside50Count = Number((Array.isArray(outside50Rows) ? outside50Rows[0] : undefined)?.c ?? 0);

      await db.execute(sql`
        INSERT INTO peg_aggregates (
          stable, window_label, computed_at, sample_count,
          mean_price, stddev_price, min_price, max_price,
          max_deviation_bps, seconds_outside_10bps, seconds_outside_50bps
        ) VALUES (
          ${addr}, ${win.label}, ${now.toISOString()}, ${sampleCount},
          ${Number(r.mean_price).toFixed(10)}, ${Number(r.stddev_price).toFixed(10)},
          ${Number(r.min_price).toFixed(10)}, ${Number(r.max_price).toFixed(10)},
          ${Number(r.max_deviation_bps).toFixed(4)},
          ${outside10Count * SAMPLE_INTERVAL_SEC},
          ${outside50Count * SAMPLE_INTERVAL_SEC}
        )
        ON CONFLICT (stable, window_label) DO UPDATE SET
          computed_at = EXCLUDED.computed_at,
          sample_count = EXCLUDED.sample_count,
          mean_price = EXCLUDED.mean_price,
          stddev_price = EXCLUDED.stddev_price,
          min_price = EXCLUDED.min_price,
          max_price = EXCLUDED.max_price,
          max_deviation_bps = EXCLUDED.max_deviation_bps,
          seconds_outside_10bps = EXCLUDED.seconds_outside_10bps,
          seconds_outside_50bps = EXCLUDED.seconds_outside_50bps
      `);
      rowsUpserted += 1;
    }
  }

  return {
    computedAt: now.toISOString(),
    stables: KNOWN_STABLECOINS.length,
    rowsUpserted,
  };
}
