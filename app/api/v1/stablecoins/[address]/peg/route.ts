import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { withReproducibility } from "@/lib/reproducibility";
import { parseAsOfFromRequest, InvalidAsOfError } from "@/lib/as-of";

export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ address: string }>;
}

// Windows always expressed as seconds-back so we can recompute on the fly.
const WINDOWS: Array<{ label: "1h" | "24h" | "7d"; seconds: number }> = [
  { label: "1h", seconds: 3600 },
  { label: "24h", seconds: 86_400 },
  { label: "7d", seconds: 604_800 },
];

export async function GET(req: Request, { params }: Params) {
  const { address } = await params;
  const stable = address.toLowerCase();

  let asOf: Date | null;
  try {
    asOf = parseAsOfFromRequest(req);
  } catch (e) {
    if (e instanceof InvalidAsOfError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    throw e;
  }

  try {
    if (asOf) {
      // Time-travel path: current = nearest sample <= asOf; windows recomputed on-the-fly.
      const cur = await db.execute(sql`
        SELECT price_vs_pathusd, spread_bps, block_number, sampled_at
        FROM peg_samples
        WHERE stable = ${stable} AND sampled_at <= ${asOf}
        ORDER BY sampled_at DESC
        LIMIT 1
      `);
      const curRows = ((cur as unknown as { rows?: Record<string, unknown>[] }).rows
        ?? (cur as unknown as Record<string, unknown>[])) as Array<Record<string, unknown>>;
      const current = curRows[0] ?? null;

      const windows = [];
      for (const w of WINDOWS) {
        const start = new Date(asOf.getTime() - w.seconds * 1000);
        const agg = await db.execute(sql`
          SELECT
            COUNT(*)::int AS sample_count,
            AVG(price_vs_pathusd)::float8 AS mean_price,
            COALESCE(STDDEV(price_vs_pathusd), 0)::float8 AS stddev_price,
            MIN(price_vs_pathusd)::float8 AS min_price,
            MAX(price_vs_pathusd)::float8 AS max_price,
            COALESCE(MAX(spread_bps), 0)::float8 AS max_deviation_bps,
            COUNT(*) FILTER (WHERE spread_bps > 10)::int * 60 AS seconds_outside_10bps,
            COUNT(*) FILTER (WHERE spread_bps > 50)::int * 60 AS seconds_outside_50bps
          FROM peg_samples
          WHERE stable = ${stable}
            AND sampled_at > ${start}
            AND sampled_at <= ${asOf}
        `);
        const aggRows = ((agg as unknown as { rows?: Record<string, unknown>[] }).rows
          ?? (agg as unknown as Record<string, unknown>[])) as Array<Record<string, unknown>>;
        const a = aggRows[0] ?? {};
        windows.push({
          window: w.label,
          computed_at: asOf,
          sample_count: Number(a.sample_count ?? 0),
          mean_price: Number(a.mean_price ?? 0),
          stddev_price: Number(a.stddev_price ?? 0),
          min_price: Number(a.min_price ?? 0),
          max_price: Number(a.max_price ?? 0),
          max_deviation_bps: Number(a.max_deviation_bps ?? 0),
          seconds_outside_10bps: Number(a.seconds_outside_10bps ?? 0),
          seconds_outside_50bps: Number(a.seconds_outside_50bps ?? 0),
        });
      }

      return withReproducibility(
        NextResponse.json({
          address: stable,
          as_of: asOf.toISOString(),
          current: current
            ? {
                price_vs_pathusd: Number(current.price_vs_pathusd),
                spread_bps: Number(current.spread_bps),
                block_number: Number(current.block_number),
                sampled_at: current.sampled_at,
              }
            : null,
          windows,
        }),
        {
          method: "peg-aggregates-v1-asof",
          rpcCall: "quoteSwapExactAmountIn(stable, pathUSD, 1e6)",
          contracts: ["0xdec0000000000000000000000000000000000000"],
          tables: ["peg_samples"],
          block: current ? Number(current.block_number) : undefined,
          freshnessSec: 60,
          asOf,
        },
      );
    }

    // Live path (unchanged): read pre-computed peg_aggregates + latest sample.
    const result = await db.execute(sql`
      SELECT window_label, computed_at, sample_count,
             mean_price, stddev_price, min_price, max_price,
             max_deviation_bps, seconds_outside_10bps, seconds_outside_50bps
      FROM peg_aggregates
      WHERE stable = ${stable}
      ORDER BY CASE window_label
        WHEN '1h' THEN 1
        WHEN '24h' THEN 2
        WHEN '7d' THEN 3
        ELSE 99
      END
    `);
    const rows = (result as unknown as { rows?: Record<string, unknown>[] }).rows
      ?? (result as unknown as Record<string, unknown>[]);

    const currentResult = await db.execute(sql`
      SELECT price_vs_pathusd, spread_bps, block_number, sampled_at
      FROM peg_samples
      WHERE stable = ${stable}
      ORDER BY sampled_at DESC
      LIMIT 1
    `);
    const currentRows = (currentResult as unknown as { rows?: Record<string, unknown>[] }).rows
      ?? (currentResult as unknown as Record<string, unknown>[]);
    const current = Array.isArray(currentRows) ? currentRows[0] : null;

    return withReproducibility(
      NextResponse.json({
        address: stable,
        current: current
          ? {
              price_vs_pathusd: Number(current.price_vs_pathusd),
              spread_bps: Number(current.spread_bps),
              block_number: Number(current.block_number),
              sampled_at: current.sampled_at,
            }
          : null,
        windows: Array.isArray(rows) ? rows.map((r) => ({
          window: r.window_label,
          computed_at: r.computed_at,
          sample_count: Number(r.sample_count),
          mean_price: Number(r.mean_price),
          stddev_price: Number(r.stddev_price),
          min_price: Number(r.min_price),
          max_price: Number(r.max_price),
          max_deviation_bps: Number(r.max_deviation_bps),
          seconds_outside_10bps: Number(r.seconds_outside_10bps),
          seconds_outside_50bps: Number(r.seconds_outside_50bps),
        })) : [],
      }),
      {
        method: "peg-aggregates-v1",
        rpcCall: "quoteSwapExactAmountIn(stable, pathUSD, 1e6)",
        contracts: ["0xdec0000000000000000000000000000000000000"],
        tables: ["peg_samples", "peg_aggregates"],
        block: current ? Number(current.block_number) : undefined,
        freshnessSec: 60,
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
