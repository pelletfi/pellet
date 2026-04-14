import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { parseAsOfFromRequest, InvalidAsOfError } from "@/lib/as-of";
import { withReproducibility } from "@/lib/reproducibility";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(100, parseInt(url.searchParams.get("limit") ?? "20", 10));

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
    const r = await db.execute(
      asOf
        ? sql`
            SELECT from_token, to_token, window_start, window_end,
                   observed_flow_usd::float8 AS observed_flow_usd,
                   baseline_mean_usd::float8 AS baseline_mean_usd,
                   baseline_stddev_usd::float8 AS baseline_stddev_usd,
                   z_score::float8 AS z_score,
                   tx_count, detected_at
            FROM flow_anomalies
            WHERE window_start <= ${asOf}
            ORDER BY window_start DESC, ABS(z_score::float8) DESC
            LIMIT ${limit}
          `
        : sql`
            SELECT from_token, to_token, window_start, window_end,
                   observed_flow_usd::float8 AS observed_flow_usd,
                   baseline_mean_usd::float8 AS baseline_mean_usd,
                   baseline_stddev_usd::float8 AS baseline_stddev_usd,
                   z_score::float8 AS z_score,
                   tx_count, detected_at
            FROM flow_anomalies
            ORDER BY window_start DESC, ABS(z_score::float8) DESC
            LIMIT ${limit}
          `,
    );
    const rows = ((r as unknown as { rows?: Record<string, unknown>[] }).rows
      ?? (r as unknown as Record<string, unknown>[])) as Array<Record<string, unknown>>;
    return withReproducibility(
      NextResponse.json({
        as_of: asOf?.toISOString() ?? null,
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
      }),
      {
        method: "flow-anomaly-z-score-v1",
        tables: ["flow_anomalies", "stablecoin_flows"],
        freshnessSec: 900,
        asOf,
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
