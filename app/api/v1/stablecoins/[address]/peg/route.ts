import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ address: string }>;
}

export async function GET(_req: Request, { params }: Params) {
  const { address } = await params;
  const stable = address.toLowerCase();

  try {
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

    // Also fetch the most recent sample for current state
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

    return NextResponse.json({
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
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
