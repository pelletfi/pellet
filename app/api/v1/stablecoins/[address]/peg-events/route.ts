import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ address: string }>;
}

export async function GET(req: Request, { params }: Params) {
  const { address } = await params;
  const stable = address.toLowerCase();
  const url = new URL(req.url);
  const limit = Math.min(100, parseInt(url.searchParams.get("limit") ?? "20", 10));

  try {
    const result = await db.execute(sql`
      SELECT severity, started_at, ended_at, duration_seconds,
             max_deviation_bps, started_block, ended_block
      FROM peg_events
      WHERE stable = ${stable}
      ORDER BY started_at DESC
      LIMIT ${limit}
    `);
    const rows = ((result as unknown as { rows?: Record<string, unknown>[] }).rows
      ?? (result as unknown as Record<string, unknown>[])) as Array<Record<string, unknown>>;

    return NextResponse.json({
      address: stable,
      events: rows.map((r) => ({
        severity: r.severity,
        started_at: r.started_at,
        ended_at: r.ended_at,
        duration_seconds: r.duration_seconds,
        max_deviation_bps: Number(r.max_deviation_bps),
        started_block: Number(r.started_block),
        ended_block: r.ended_block != null ? Number(r.ended_block) : null,
        ongoing: r.ended_at == null,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
