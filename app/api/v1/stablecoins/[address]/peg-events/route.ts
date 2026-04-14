import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { parseAsOfFromRequest, InvalidAsOfError } from "@/lib/as-of";
import { withReproducibility } from "@/lib/reproducibility";

export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ address: string }>;
}

export async function GET(req: Request, { params }: Params) {
  const { address } = await params;
  const stable = address.toLowerCase();
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
    const result = await db.execute(
      asOf
        ? sql`
            SELECT severity, started_at, ended_at, duration_seconds,
                   max_deviation_bps, started_block, ended_block
            FROM peg_events
            WHERE stable = ${stable} AND started_at <= ${asOf}
            ORDER BY started_at DESC
            LIMIT ${limit}
          `
        : sql`
            SELECT severity, started_at, ended_at, duration_seconds,
                   max_deviation_bps, started_block, ended_block
            FROM peg_events
            WHERE stable = ${stable}
            ORDER BY started_at DESC
            LIMIT ${limit}
          `,
    );
    const rows = ((result as unknown as { rows?: Record<string, unknown>[] }).rows
      ?? (result as unknown as Record<string, unknown>[])) as Array<Record<string, unknown>>;

    return withReproducibility(
      NextResponse.json({
        address: stable,
        as_of: asOf?.toISOString() ?? null,
        events: rows.map((r) => {
          const ongoing = asOf
            ? r.ended_at == null || new Date(r.ended_at as string) > asOf
            : r.ended_at == null;
          return {
            severity: r.severity,
            started_at: r.started_at,
            // If as_of freezes before the event ended, hide the later end
            ended_at: asOf && r.ended_at && new Date(r.ended_at as string) > asOf ? null : r.ended_at,
            duration_seconds: r.duration_seconds,
            max_deviation_bps: Number(r.max_deviation_bps),
            started_block: Number(r.started_block),
            ended_block: r.ended_block != null ? Number(r.ended_block) : null,
            ongoing,
          };
        }),
      }),
      {
        method: "peg-events-v1",
        tables: ["peg_events"],
        freshnessSec: 120,
        asOf,
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
