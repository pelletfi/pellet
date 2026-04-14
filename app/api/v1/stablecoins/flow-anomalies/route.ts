import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(100, parseInt(url.searchParams.get("limit") ?? "20", 10));
  try {
    const r = await db.execute(sql`
      SELECT from_token, to_token, window_start, window_end,
             observed_flow_usd::float8 AS observed_flow_usd,
             baseline_mean_usd::float8 AS baseline_mean_usd,
             baseline_stddev_usd::float8 AS baseline_stddev_usd,
             z_score::float8 AS z_score,
             tx_count, detected_at
      FROM flow_anomalies
      ORDER BY window_start DESC, ABS(z_score::float8) DESC
      LIMIT ${limit}
    `);
    const rows = ((r as unknown as { rows?: Record<string, unknown>[] }).rows
      ?? (r as unknown as Record<string, unknown>[])) as Array<Record<string, unknown>>;
    return NextResponse.json({
      anomalies: rows.map((a) => ({
        from_token: a.from_token,
        to_token: a.to_token,
        window_start: a.window_start,
        window_end: a.window_end,
        observed_flow_usd: Number(a.observed_flow_usd),
        baseline_mean_usd: Number(a.baseline_mean_usd),
        baseline_stddev_usd: Number(a.baseline_stddev_usd),
        z_score: Number(a.z_score),
        tx_count: a.tx_count,
        detected_at: a.detected_at,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
