import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

// Public: returns latest run per cron + 24h success rate.
export async function GET() {
  try {
    const r = await db.execute(sql`
      WITH latest AS (
        SELECT DISTINCT ON (cron_name)
          cron_name, status, duration_ms, started_at, error
        FROM cron_runs
        ORDER BY cron_name, started_at DESC
      ),
      stats_24h AS (
        SELECT
          cron_name,
          COUNT(*)::int AS total,
          SUM(CASE WHEN status = 'ok' THEN 1 ELSE 0 END)::int AS ok,
          AVG(duration_ms)::int AS avg_duration_ms
        FROM cron_runs
        WHERE started_at >= NOW() - INTERVAL '24 hours'
        GROUP BY cron_name
      )
      SELECT l.cron_name, l.status, l.duration_ms, l.started_at, l.error,
             s.total, s.ok, s.avg_duration_ms
      FROM latest l
      LEFT JOIN stats_24h s ON l.cron_name = s.cron_name
      ORDER BY l.cron_name
    `);
    const rows = ((r as unknown as { rows?: Record<string, unknown>[] }).rows
      ?? (r as unknown as Record<string, unknown>[])) as Array<Record<string, unknown>>;

    return NextResponse.json({
      crons: rows.map((row) => ({
        name: row.cron_name,
        latest_status: row.status,
        latest_duration_ms: Number(row.duration_ms),
        latest_started_at: row.started_at,
        latest_error: row.error,
        runs_24h: row.total != null ? Number(row.total) : 0,
        ok_24h: row.ok != null ? Number(row.ok) : 0,
        avg_duration_ms_24h: row.avg_duration_ms != null ? Number(row.avg_duration_ms) : null,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
